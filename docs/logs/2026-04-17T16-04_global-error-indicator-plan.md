# Session Log — 2026-04-17 16:04

## Goal

Design a unified frontend error-state indicator. Problem reported: with the API down, clicking "Add Card" appeared to do nothing — the backend failure was silently swallowed because most mutations in the web app lack `try/catch` around `api()` calls. User wanted a small error notification container in the header, near the username, expandable for details, and unified across the app.

## Prompts and Actions

### Prompt 1 — "lets plan out how to: [add error indication]…"

Explored the current error-handling surface:

- Read [packages/web/src/lib/api.ts](../../packages/web/src/lib/api.ts) — central `api()` wrapper throws a typed `ApiError` on non-2xx; no global side effects.
- Grep'd for `api(` / `try {` / `catch` across `packages/web/src` — 30 `api()` call sites across 8 files, only 2 of them (the drag-reorder paths in [boards/[boardId]/+page.svelte:264](../../packages/web/src/routes/boards/[boardId]/+page.svelte#L264) and [:292](../../packages/web/src/routes/boards/[boardId]/+page.svelte#L292)) catch the thrown error and surface a local `boardError` banner. All other mutations (addCard, updateCard, renameList, archiveList, archiveCard, setCardDueDate, unarchiveList, etc.) are fire-and-forget.
- Confirmed the header in [+layout.svelte](../../packages/web/src/routes/+layout.svelte) has no status affordance today.

Presented three approaches:

- **A.** Global error store + header badge (Svelte 5 runes module; `api()` auto-pushes; click to expand).
- **B.** Toast + header hybrid.
- **C.** Connectivity-aware banner with a `/health` heartbeat.

Asked five scoping questions (silent vs loud, auto-dismiss, heartbeat, excluded codes, retry UX).

### Prompt 2 — User answers: A, no toasts, no auto-clear, no heartbeat, no exclusions, no retry

Locked in approach A with the minimal scope. Produced a concrete plan outline: store module, `api()` wrapping, indicator component, layout mount, unit tests only.

### Prompt 3 — "write a detailed plan doc in plans/"

Inspected existing planning conventions in [docs/plans/](../plans/) (uses `X_` prefix for completed and `O_` for not-started). Read [docs/plans/X_done-column.md](../plans/X_done-column.md) to pattern-match the structure (Context → Design Decisions → Implementation → Testing → Files Touched → Out of Scope).

Wrote [docs/plans/O_global-error-indicator.md](../plans/O_global-error-indicator.md). Key contents:

- Context explains the silent-failure symptom ("Add Card did nothing").
- Design decisions capture why approach A over B/C, why no auto-clear, why no filtering, why a 50-entry cap, why the unhandled-rejection fallback, and why the existing `boardError` banner stays.
- Implementation provides concrete code sketches for: `errorStore.svelte.ts` (runes-based module, `add`/`clear`/`count`), `api.ts` modifications (wrap fetch in try/catch so network-level TypeError is captured alongside `ApiError`), `ErrorIndicator.svelte` (red dot + count, click to expand dropdown, clear-all button, outside-click backdrop), and layout mount inside `.nav-right`.
- Testing plan covers unit tests for the store (add, clear, cap) and for `api()` error paths (500 response, network failure, 2xx no-op). E2E skipped.
- Files Touched lists 2 modified (`api.ts`, `+layout.svelte`) and up to 4 new files.
- Out of Scope enumerates everything deferred (toasts, auto-clear, heartbeat, filtering, retry, cross-reload persistence).

### Prompt 4 — "update the log with what you see has changed"

Wrote this session log.

## Files Created

- `docs/plans/O_global-error-indicator.md` — detailed implementation plan.
- `docs/logs/2026-04-17T16-04_global-error-indicator-plan.md` — this log.

## Files Modified

None. This session produced planning artifacts only; no source code has been changed.

## Key Decisions

- **Approach A (global store + badge) over toast or heartbeat variants.** Least visual noise, zero call-site changes, solves the silent-failure problem immediately. User confirmed.
- **No behavioral change to `api()` callers.** The store push happens before the rethrow; existing `try/catch` code continues to work as-is.
- **`window.unhandledrejection` listener as a safety net.** Catches any rejection that bypasses `api()` (e.g. future direct `fetch` usage or schema-parse failures in callers), so the badge is the single place to look.
- **No filtering of expected errors (401, 404) in v1.** Simplicity over polish; revisit if daily use proves noisy.
- **Keep the existing `boardError` banner.** It's complementary (local "refreshing…" hint); the same failure also lands in the global log.
- **50-entry cap.** Prevents unbounded growth while the backend is down during heavy interaction.

## Task Completion

| Task | Status |
|------|--------|
| Survey existing error-handling coverage in web app | Done |
| Propose and compare approaches | Done |
| Agree on scope via Q&A | Done |
| Write detailed plan doc in `docs/plans/` | Done |
| Implement the plan | Not started (deferred to a future session) |
