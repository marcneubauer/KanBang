import type { Handle, RequestEvent } from '@sveltejs/kit';

const API_URL = process.env.API_URL || 'http://localhost:3001';

const PROXY_HEADER_ALLOWLIST = ['cookie', 'content-type', 'accept', 'accept-language', 'authorization'];

const AUTH_CACHE_TTL_MS = 30_000;
const AUTH_CACHE_MAX_ENTRIES = 500;

interface AuthCacheEntry {
  user: App.Locals['user'];
  expiresAt: number;
}

const authCache = new Map<string, AuthCacheEntry>();

async function resolveUser(sessionCookie: string): Promise<App.Locals['user']> {
  const cached = authCache.get(sessionCookie);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  authCache.delete(sessionCookie);

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { cookie: `kanbang_session=${sessionCookie}` },
    });
    if (!res.ok) return null;

    const { user } = await res.json();
    if (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
      for (const [key, entry] of authCache) {
        if (entry.expiresAt <= Date.now()) authCache.delete(key);
      }
    }
    authCache.set(sessionCookie, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
    return user;
  } catch {
    return null;
  }
}

function buildProxyHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of PROXY_HEADER_ALLOWLIST) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

async function proxyToApi(event: RequestEvent): Promise<Response> {
  const apiUrl = `${API_URL}${event.url.pathname}${event.url.search}`;
  const response = await fetch(apiUrl, {
    method: event.request.method,
    // Forward the raw stream — reading as text would corrupt binary bodies (image uploads)
    body: event.request.method !== 'GET' ? event.request.body : undefined,
    headers: buildProxyHeaders(event.request),
    // @ts-expect-error: duplex is required at runtime for streaming bodies but missing from RequestInit types
    duplex: 'half',
  });

  if (event.url.pathname === '/api/v1/auth/logout' && response.ok) {
    const sessionCookie = event.cookies.get('kanbang_session');
    if (sessionCookie) authCache.delete(sessionCookie);
  }

  // Build headers manually — the Fetch API's Headers object strips Set-Cookie
  const proxyHeaders = new Headers(response.headers);
  const setCookies = response.headers.getSetCookie();
  const res = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: proxyHeaders,
  });
  // Re-append Set-Cookie headers that got stripped
  for (const cookie of setCookies) {
    res.headers.append('set-cookie', cookie);
  }
  return res;
}

export const handle: Handle = async ({ event, resolve }) => {
  // Proxied API requests are authenticated by the backend itself — skip the
  // /auth/me pre-flight entirely to avoid doubling round-trips.
  if (event.url.pathname.startsWith('/api/')) {
    return proxyToApi(event);
  }

  const sessionCookie = event.cookies.get('kanbang_session');
  event.locals.user = sessionCookie ? await resolveUser(sessionCookie) : null;

  return resolve(event);
};
