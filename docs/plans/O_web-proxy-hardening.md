# Plan: Web Proxy Hardening

## Context

A security review of the web package flagged two concerns in [hooks.server.ts](../../packages/web/src/hooks.server.ts) that should be addressed before production:

1. **Header forwarding is unfiltered** (line 32) — the `/api/*` proxy passes `event.request.headers` verbatim to the backend. Client-controlled headers like `X-Forwarded-For`, `X-Forwarded-Host`, `Authorization`, and `Host` all flow through. If the backend ever trusts any of these for rate limiting, audit logs, or routing, a client can spoof them.
2. **`/auth/me` is called on every request** (line 11) — including requests for static assets and API proxy calls. No caching means every hit incurs a backend round-trip, and any transient backend failure silently flips `locals.user` to `null` for that request.

Finding #4 (error-message enumeration on login/register) is tracked separately in `docs/feature-ideas.md`; the user wants to keep detailed errors for now and will revisit before a public deployment.

Finding #3 (cookie-forwarding inconsistency), #5 (`API_URL` validation), and #6 (Set-Cookie flag test) are low severity / informational and are not addressed here.

---

## Design Decisions

### 1. Header allowlist on the proxy

Only forward headers that the backend actually needs. The backend's routes read:

- `cookie` — for session auth
- `content-type` — for JSON parsing
- `accept` — for content negotiation (currently unused but harmless)
- `accept-language` — for future i18n (harmless)

Everything else (`authorization`, `x-forwarded-*`, `host`, `origin`, `referer`, custom headers) is dropped. If a future feature needs a new header, add it explicitly to the allowlist.

Rejected alternatives:

- **Denylist known-dangerous headers** — fragile. New headers added by browsers or frameworks (e.g. `Sec-Fetch-*`, `Priority`) would pass through by default. Allowlist is safer.
- **Trust the backend to ignore spoofed headers** — defense in depth; cheap to do both.

### 2. Cache `/auth/me` per-session

Cache the resolved user object keyed by session cookie value for a short TTL (30 seconds). This covers bursts of requests (HTML + hydration + data loads + API proxying all within a second or two) without making session invalidation observably slow — a logout on another tab becomes visible within 30 s, which matches the user experience of a cookie-based session.

Storage: module-level `Map<sessionCookie, { user, expiresAt }>` in `hooks.server.ts`. This lives in the SvelteKit server process memory. Since KanBang is single-node (adapter-node), no shared cache is needed. Entries self-evict on read when expired; no GC timer required.

Cache is bypassed (and populated) on miss or expiry. On fetch failure, fall through to the existing `locals.user = null` behavior — do NOT serve a stale cached user, because that would mask a deliberate logout.

Rejected alternatives:

- **No cache, just reduce calls to HTML requests only** — `event.route` / `event.isSubRequest` checks are brittle; static assets already don't hit SvelteKit handlers in production (served by adapter-node's static layer), so the real saving is from duplicate calls during a single page render.
- **Longer TTL (minutes)** — delays logout visibility across tabs and background tasks. 30 s is the sweet spot.
- **Cache in a cookie or header** — opens a whole new trust/tampering surface. In-memory is fine for single-node.

---

## Implementation Steps

### Step 1 — Add header allowlist to the proxy

File: [packages/web/src/hooks.server.ts](../../packages/web/src/hooks.server.ts)

Replace the `headers: event.request.headers` on line 32 with an allowlisted `Headers` instance:

```ts
const ALLOWED_PROXY_HEADERS = ['cookie', 'content-type', 'accept', 'accept-language'];

function buildProxyHeaders(source: Headers): Headers {
  const out = new Headers();
  for (const name of ALLOWED_PROXY_HEADERS) {
    const v = source.get(name);
    if (v) out.set(name, v);
  }
  return out;
}
```

Use `buildProxyHeaders(event.request.headers)` in the proxy `fetch()`.

### Step 2 — Add in-memory `/auth/me` cache

File: [packages/web/src/hooks.server.ts](../../packages/web/src/hooks.server.ts)

```ts
const AUTH_CACHE_TTL_MS = 30_000;
type CacheEntry = { user: User | null; expiresAt: number };
const authCache = new Map<string, CacheEntry>();

async function resolveUser(sessionCookie: string): Promise<User | null> {
  const now = Date.now();
  const hit = authCache.get(sessionCookie);
  if (hit && hit.expiresAt > now) return hit.user;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { cookie: `kanbang_session=${sessionCookie}` },
    });
    const user = res.ok ? (await res.json()).user : null;
    authCache.set(sessionCookie, { user, expiresAt: now + AUTH_CACHE_TTL_MS });
    return user;
  } catch {
    return null; // do not cache failures
  }
}
```

Invoke `resolveUser(sessionCookie)` in the handler to set `event.locals.user`.

### Step 3 — Invalidate the cache on logout

If the proxy sees a successful `POST /api/v1/auth/logout`, delete the corresponding entry from `authCache` (use the cookie from the incoming request). Otherwise a user who just logged out would still appear logged in for up to 30 s. This is the one place we must be precise because the user's intent is explicit.

### Step 4 — Tests

Add Vitest integration tests in `packages/web/src/` that use `fetch`-mocking (or a minimal stub of the handler) to verify:

- A request with `x-forwarded-for: 1.2.3.4` does NOT forward that header to the backend.
- `authorization: Bearer xyz` is not forwarded.
- `cookie` and `content-type` ARE forwarded.
- Two back-to-back requests with the same session cookie result in only one `/auth/me` call.
- A logout `POST` clears the cache entry, so the next request re-fetches `/auth/me`.

---

## Out of Scope

- Finding #3 (cookie inconsistency between `/auth/me` and proxy path).
- Finding #4 (error-message enumeration) — tracked as a feature-ideas entry; keep current behavior.
- Finding #5 (`API_URL` validation).
- Finding #6 (`Set-Cookie` flag assertion test).

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes, including new tests in step 4.
- Manual: log in, observe a page load triggers exactly one `/auth/me` call in the API logs (previously one per sub-request). Log out → verify the next request shows the logged-out state immediately, not after a delay.
