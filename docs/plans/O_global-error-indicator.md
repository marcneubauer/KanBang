# Plan: Global Error Indicator

## Context

Today the web app silently drops most API failures. When the backend is down or a request fails, the user sees no feedback — clicking "Add Card" appears to do nothing. Only the drag-reorder paths in `packages/web/src/routes/boards/[boardId]/+page.svelte` wrap `api()` calls in `try/catch` and surface a local `boardError` banner. All other mutations (`addCard`, `updateCard`, `renameList`, `archiveList`, `archiveCard`, `setCardDueDate`, etc.) are fire-and-forget: the thrown `ApiError` becomes an unhandled promise rejection in the console.

This plan adds a single, unified error indicator in the top navigation bar so any failed request is visible immediately without requiring per-call-site changes.

---

## Design Decisions

### Approach: global error store + header badge

A Svelte 5 runes module holds an array of recent error entries. The `api()` wrapper pushes every failure onto the store before rethrowing. A small indicator component in the nav bar reads the store and displays a red badge with a count next to the username. Clicking expands a dropdown listing recent failures.

Alternatives considered and rejected:

- **Toast notifications** — more visually noisy; user wants quiet.
- **Per-page banners** — doesn't unify; would require touching every consumer.
- **Connectivity heartbeat** (`/health` ping) — overkill for a personal tool; rejected.

### No behavioral change to callers

`api()` still throws the same `ApiError`. The store push happens *before* the rethrow, so existing `try/catch` code (the drag-reorder paths, `CardDetailModal`, etc.) continues to work. Call sites need no modifications.

### No auto-clear

Entries persist until the user clicks "Clear all". The user should decide when they've acknowledged the errors.

### No filtering by code or status

All failures are recorded — including expected ones like 401 on login or 404 on a missing board. If this proves noisy we revisit later; for now simplicity wins.

### No retry affordance

Entries are informational only. If a user wants to retry, they repeat the action that caused it.

### 50-entry cap

The store caps at 50 entries, dropping oldest on overflow. Prevents unbounded growth if the backend is down during heavy interaction.

### Unhandled-rejection fallback

A `window.addEventListener('unhandledrejection', …)` listener in the store module captures anything that bypasses `api()` (e.g. a future direct `fetch` call, or a schema parse failure inside a caller). Registered once on first browser-side import.

### Local `boardError` banner stays

The existing "Failed to reorder list. Refreshing board..." banner in `boards/[boardId]/+page.svelte` remains — it's complementary context (tells the user their board is about to refresh). The same failure also appears in the global indicator.

---

## Implementation

### 1. Error store

**New file:** `packages/web/src/lib/errorStore.svelte.ts`

```ts
export type ErrorEntry = {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  status: number | null; // null for network / non-HTTP errors
  code: string;
  message: string;
};

const MAX_ENTRIES = 50;

function createStore() {
  let entries = $state<ErrorEntry[]>([]);

  return {
    get entries() {
      return entries;
    },
    get count() {
      return entries.length;
    },
    add(entry: Omit<ErrorEntry, 'id' | 'timestamp'>) {
      const full: ErrorEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      entries = [full, ...entries].slice(0, MAX_ENTRIES);
    },
    clear() {
      entries = [];
    },
  };
}

export const errorStore = createStore();

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    errorStore.add({
      method: 'UNHANDLED',
      path: '',
      status: null,
      code: reason?.name ?? 'UNHANDLED_REJECTION',
      message: reason?.message ?? String(reason),
    });
  });
}
```

### 2. Wire `api()` to push on failure

**Modify:** `packages/web/src/lib/api.ts`

Wrap the fetch call in a try/catch so network errors (TypeError from fetch) also get recorded, and push before rethrowing `ApiError`.

```ts
import { errorStore } from './errorStore.svelte';

// Inside api():
const method = (options.method ?? 'GET').toUpperCase();

let response: Response;
try {
  response = await fetchFn(url, { ...options, headers, credentials: 'include' });
} catch (err) {
  errorStore.add({
    method,
    path,
    status: null,
    code: 'NETWORK_ERROR',
    message: err instanceof Error ? err.message : 'Network request failed',
  });
  throw err;
}

if (!response.ok) {
  const body = await response.json().catch(() => ({ code: 'PARSE_ERROR', error: 'Could not parse error response' }));
  const apiErr = new ApiError(
    response.status,
    body.code ?? 'UNKNOWN',
    body.error ?? 'Request failed',
    body.details,
  );
  errorStore.add({
    method,
    path,
    status: apiErr.status,
    code: apiErr.code,
    message: apiErr.message,
  });
  throw apiErr;
}
```

The SSR path (load functions using the server `fetch`) still works because the store's side-effects guard on `typeof window`; the `errorStore.add` call during SSR is a no-op in terms of persistence (state is per-module-instance per render) but harmless. In practice, SSR load errors throw before `api()` returns and SvelteKit handles them via `+error.svelte` pages — the indicator is a client-side affordance.

### 3. Indicator component

**New file:** `packages/web/src/lib/components/ErrorIndicator.svelte`

```svelte
<script lang="ts">
  import { errorStore } from '$lib/errorStore.svelte';

  let open = $state(false);

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString();
  }

  function handleBackdropClick() {
    open = false;
  }
</script>

{#if errorStore.count > 0}
  <div class="error-indicator-wrapper">
    <button
      class="error-indicator"
      onclick={() => { open = !open; }}
      aria-label={`${errorStore.count} errors`}
    >
      <span class="error-dot"></span>
      <span class="error-count">{errorStore.count}</span>
    </button>

    {#if open}
      <div class="error-backdrop" onclick={handleBackdropClick} role="presentation"></div>
      <div class="error-panel" role="dialog">
        <div class="error-panel-header">
          <span>Recent errors</span>
          <button class="error-clear" onclick={() => { errorStore.clear(); open = false; }}>
            Clear all
          </button>
        </div>
        <ul class="error-list">
          {#each errorStore.entries as entry (entry.id)}
            <li class="error-entry">
              <div class="error-entry-head">
                <span class="error-time">{formatTime(entry.timestamp)}</span>
                <span class="error-status">
                  {entry.method}{entry.path ? ` ${entry.path}` : ''}
                  {entry.status !== null ? `— ${entry.status}` : ''}
                </span>
              </div>
              <div class="error-message">{entry.code}: {entry.message}</div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* red dot + count button; absolutely-positioned dropdown panel; see below */
</style>
```

Styling goals:

- Button: small, red circular dot with the count to its right, vertically centered in the nav.
- Panel: `position: absolute` below the indicator, right-aligned, ~360px wide, max-height ~400px, scrollable.
- Backdrop: transparent `fixed` overlay behind the panel to catch outside clicks.
- Entry rows: monospaced for the `METHOD /path — status` line, regular for the message.

### 4. Mount in the layout

**Modify:** `packages/web/src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import '../app.css';
  import { api } from '$lib/api';
  import ErrorIndicator from '$lib/components/ErrorIndicator.svelte';
  // ...
</script>

{#if data.user}
  <nav class="nav">
    <a href="/boards" class="nav-brand">KanBang</a>
    <div class="nav-right">
      <ErrorIndicator />
      <span class="nav-user">{data.user.username}</span>
      <a href="/settings" class="nav-link">Settings</a>
      <button class="nav-logout" onclick={logout} aria-label="Log out">Log out</button>
    </div>
  </nav>
{/if}
```

Indicator is placed first in `.nav-right` so it sits to the left of the username, as requested.

---

## Testing

### Unit tests

**New file:** `packages/web/src/lib/errorStore.test.ts`

- `add()` prepends an entry with a generated id and timestamp.
- `clear()` empties the list.
- Cap: adding 51 entries leaves exactly 50, with oldest dropped.

**Extend:** `packages/web/src/lib/api.test.ts` (create if missing)

- 500 response: store receives one entry with `status: 500` and the thrown code/message.
- Network failure (mocked `fetch` throws `TypeError`): store receives one entry with `status: null` and `code: 'NETWORK_ERROR'`.
- 2xx response: store count remains 0.

Run: `pnpm --filter @kanbang/web test`.

### Manual verification

1. `pnpm dev`, log in, open a board.
2. Stop the API (`Ctrl-C` the api dev server).
3. Click "Add Card" on any list. The red badge appears in the header with count 1.
4. Click it; verify the dropdown lists `POST /lists/{id}/cards — NETWORK_ERROR`.
5. Click "Clear all"; badge disappears.
6. Restart the API; subsequent successful actions do not re-add entries.

### E2E

Skipped. Store behavior is fully covered by unit tests and the surface area in the browser is small.

---

## Files Touched

**New:**

- `packages/web/src/lib/errorStore.svelte.ts`
- `packages/web/src/lib/components/ErrorIndicator.svelte`
- `packages/web/src/lib/errorStore.test.ts`
- `packages/web/src/lib/api.test.ts` (if not present)

**Modified:**

- `packages/web/src/lib/api.ts` — wrap fetch in try/catch, push on both failure paths.
- `packages/web/src/routes/+layout.svelte` — import and render `<ErrorIndicator />`.

---

## Out of Scope

- Toast notifications.
- Auto-clear / auto-dismiss.
- Health-check heartbeat and distinct "Disconnected" state.
- Filtering out expected errors (401 on login, 404 on missing board).
- Retry buttons.
- Persisting the error log across reloads.

These may be revisited in a follow-up once we see how the minimal version feels in daily use.
