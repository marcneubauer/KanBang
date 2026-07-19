# Plan — Dark Mode & App Theming

**Status:** planned, not started. Dex: see "Dark mode & theming" task + subtasks.
**Written:** 2026-07-19.

## Goal

1. A real dark mode: per-user preference **light / dark / system**, applied without flash-of-wrong-theme (FOUC), persisted server-side so it follows the user across devices.
2. A darker main screen: the boards-overview page (and app shell) should stop being locked to the light gray `#f5f6f8`. Dark mode largely delivers this; a stretch phase adds a customizable app-shell background.
3. Board backgrounds/accents (shipped 2026-07) must keep working in both themes.

## Current state (measured 2026-07-19)

- `packages/web/src/app.css` defines 9 tokens on `:root` (bg, surface, primary, primary-hover, text, text-subtle, border, danger, radius×2). Everything else is hardcoded per component.
- Hardcoded color counts (grep for `#fff|white|#172b4d|#f5f6f8|rgba(`): ListColumn 15, board page 12, CardDetailModal 12, BoardSettingsModal 9, CardLabelsSection 7, +layout 6, ErrorIndicator 6, QuickEditPopover 5, BoardCard 5, ArchivedPanel 5, Toaster 5, settings 4, boards page 3, register/login 2 each, DatePicker 2. These all need the token sweep.
- Board pages already override `--color-primary` locally (accent from background via `resolveBoardAccent`, hovers via `color-mix`) — that mechanism is theme-independent and must keep winning inside board pages.
- The frosted list-column treatment (translucent white over board backgrounds) needs a dark counterpart (translucent dark).

## Phase 1 — Token sweep (no visual change)

Expand the palette in `app.css` and replace every hardcoded color with a token. New tokens (light values chosen to match today's pixels exactly):

```css
:root {
  --color-bg: #f5f6f8;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;   /* modals, popovers */
  --color-input-bg: #ffffff;
  --color-overlay: rgba(0, 0, 0, 0.5);      /* modal backdrop */
  --color-frost: rgba(255, 255, 255, 0.75); /* list columns over board bg */
  --color-text: #172b4d;
  --color-text-subtle: #5e6c84;
  --color-text-inverse: #ffffff;     /* text on primary/accent */
  --color-border: #dfe1e6;
  --color-primary: #0079bf;
  --color-primary-hover: #026aa7;
  --color-danger: #eb5a46;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);
}
```

Adjust names to what the sweep actually finds — the list above is a starting inventory, not gospel. Rule: after this phase, `grep -rn "#fff\|white\|rgba(" packages/web/src --include="*.svelte"` should return (near) zero hits in `<style>` blocks; light mode must be pixel-identical. Commit this phase alone — it's the big diff, keep it review-able.

## Phase 2 — Theme preference infrastructure

**DB/API:**
- `users.theme` text column, `'light' | 'dark' | 'system'`, default `'system'` (migration via `pnpm db:generate` from root, Node 25 nvm first; next number after the attachments plan's 0016 — check `ls packages/api/src/db/migrations`).
- `PATCH /api/v1/users/me` accepting `{ theme }` (Zod enum in `packages/shared/src/validation/`), returns the user. Lives alongside the existing auth/change-password routes.
- ⚠️ **Serialization:** add `theme` to the `user` $id schema in `packages/api/src/schemas/index.ts` and to the `/auth/me` response, or it will be silently stripped (fast-json-stringify strips undeclared fields).

**Applying the theme without FOUC:**
- SSR: in `hooks.server.ts` `resolve(event, { transformPageChunk })`, replace a placeholder in `app.html` (`<html lang="en" data-theme="%kanbang.theme%">`) with `locals.user?.theme ?? 'system'`. `locals.user` already exists on every non-API request; `/auth/me` must now return `theme` for it (the 30s auth cache means a theme change can lag other tabs by ≤30s — acceptable).
- Inline `<script>` in `app.html` `<head>` (runs before first paint): if `data-theme` is `system`, resolve via `matchMedia('(prefers-color-scheme: dark)')` and set `data-theme` to the result; also read a `localStorage.kanbangTheme` mirror so the login page (no user) honors the last-known choice. Listen for `change` on the media query while in system mode.
- CSS: a single `:root[data-theme='dark'] { ... }` override block + `color-scheme: dark` (native scrollbars, inputs, date picker). Because the inline script resolves `system` → `light`/`dark` before paint, **no duplicated `@media (prefers-color-scheme)` token block is needed**.
- Client toggle: settings page → new "Appearance" section, radio Light / Dark / System. On change: set `document.documentElement.dataset.theme` immediately, mirror to localStorage, `PATCH /users/me`. (Optional nicety: a sun/moon quick-toggle in the header.)

**Tests:** integration — PATCH validates enum + persists + round-trips through `/auth/me` (serialization check); hooks.server.test.ts — transformPageChunk injects the theme.

## Phase 3 — Dark palette & component polish

Proposed dark values (Trello-adjacent, tune by eye):

```css
:root[data-theme='dark'] {
  color-scheme: dark;
  --color-bg: #1d2125;
  --color-surface: #282e33;
  --color-surface-raised: #32383e;
  --color-input-bg: #22272b;
  --color-overlay: rgba(0, 0, 0, 0.65);
  --color-frost: rgba(29, 33, 37, 0.75);
  --color-text: #b6c2cf;
  --color-text-subtle: #8c9bab;
  --color-text-inverse: #1d2125;
  --color-border: #3d444c;
  --color-primary: #579dff;
  --color-primary-hover: #85b8ff;
  --color-danger: #f87168;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
}
```

Known trouble spots to QA deliberately:
- **Board pages:** the board's own background + accent (`--color-primary` scoped override) must still win; only surfaces (columns, cards, modals, header) go dark. The gradient presets look fine on dark; no changes needed there.
- **Label chips** (`CardLabelsSection`, BoardCard badges): the palette colors were picked for white cards — check text contrast on each, may need a darkened chip variant or `color-mix` text.
- **Card aging** fades by opacity tiers — verify faded cards are still legible on dark surfaces.
- Toaster, ErrorIndicator, QuickEditPopover, DatePicker, ArchivedPanel — all had hardcoded colors; after the Phase 1 sweep they inherit, but eyeball each.
- Aim for WCAG AA (4.5:1) on text/subtle-text against their surfaces — the proposed values pass, keep it true if tuning.

## Phase 4 (stretch) — Custom app-shell background

Lets the user pick the boards-overview/main-screen background explicitly (their "something darker" ask even outside dark mode):
- `users.appBackgroundType` / `appBackgroundValue` mirroring the board columns (`color | gradient`, + `image` once the attachments plan ships); reuse `BACKGROUND_GRADIENT_PRESETS` and the BoardSettingsModal picker UI as a settings-page section.
- Render on `routes/boards/+page.svelte` (and optionally the app shell in `+layout.svelte` outside board pages).
- Same serialization/docs tripwires as Phase 2. Skip accent derivation — app shell keeps the theme primary.

## Docs (same-change rule)

Per phase: `docs/FEATURES.md` (Appearance section: theme setting, where it lives), `docs/specs/03-rest-api.md` (`PATCH /users/me`, `theme` on the user object), README highlights (dark mode). Phase 1 needs no doc changes (no behavior change).

## Suggested phase split (mirrors dex subtasks)

1. Token sweep (pure refactor, pixel-identical light mode).
2. Theme preference: column + PATCH + SSR/no-FOUC plumbing + settings UI.
3. Dark palette + component QA pass.
4. (Stretch) app-shell background customization.

Phases 1→2→3 are strictly ordered; 4 is independent after 2. Commit per phase; `pnpm test` + `pnpm typecheck` green each time. Svelte 5 runes + `onclick=` conventions throughout.
