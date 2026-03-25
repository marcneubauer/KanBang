# Code Review Fixes

## Context

A comprehensive 4-agent review of the KanBang codebase identified issues across code quality, unused code, documentation accuracy, security, and accessibility. This plan organizes all actionable findings into delegatable work packages.

---

## Work Package 1: Auth Middleware & Route Safety (Critical)

**Goal:** Fix the `requireAuth` middleware so it halts execution on 401, then remove all `request.user!` non-null assertions.

### Tasks

- [ ] **1a.** In `packages/api/src/plugins/auth.ts`, add `return` before `reply.code(401).send(...)` in `requireAuth` so the handler stops executing on unauthenticated requests
- [ ] **1b.** Across all route files (`boards/index.ts`, `lists/index.ts`, `cards/index.ts`, `passkeys/index.ts`), replace every `request.user!.id` with `request.user.id` (the `return` in 1a guarantees it's set)
- [ ] **1c.** Update the `FastifyRequest` type augmentation so `user` is non-optional after `requireAuth` runs (if feasible with Fastify's typing)

**Files:** `packages/api/src/plugins/auth.ts`, all files under `packages/api/src/routes/`

---

## Work Package 2: Extract Validation & Authorization Helpers (Medium)

**Goal:** Eliminate duplicated validation and ownership-check boilerplate across route handlers.

### Tasks

- [ ] **2a.** Create a `validateBody<T>(schema, request, reply)` helper that calls `safeParse`, sends 400 on failure, and returns `parsed.data | null`. Place in `packages/api/src/utils/validate.ts` or similar
- [ ] **2b.** Replace all 11 inline validation blocks in route files with calls to the helper
- [ ] **2c.** Create a `verifyBoardOwnership(boardId, userId, reply)` helper and a `verifyListOwnership(listId, userId, reply)` helper (the latter calls `listService.getBoardId` + the former)
- [ ] **2d.** Replace the 5 duplicated ownership checks in `lists/index.ts` and the card ownership checks in `cards/index.ts`
- [ ] **2e.** Standardize HTTP status codes: use 404 when the resource doesn't exist, 403 when the user doesn't own it (currently lists/cards return 404 for both)

**Files:** New `packages/api/src/utils/validate.ts`, all files under `packages/api/src/routes/`

---

## Work Package 3: Clean Up Unused Shared Types (Low)

**Goal:** Remove exported types that are never imported anywhere in the codebase.

### Tasks

- [ ] **3a.** Remove `RegisterRequest`, `LoginRequest`, `AuthResponse` from `packages/shared/src/types/auth.ts`
- [ ] **3b.** Remove `User` from `packages/shared/src/types/user.ts` (delete the file if empty)
- [ ] **3c.** Remove `BoardWithLists` from `packages/shared/src/types/board.ts` and `ListWithCards` from `packages/shared/src/types/list.ts`
- [ ] **3d.** Remove `generateNKeysBetween` from the re-export in `packages/shared/src/index.ts` (keep the function itself for tests, just don't export from the barrel)
- [ ] **3e.** Run `pnpm typecheck` to confirm nothing breaks

**Files:** `packages/shared/src/types/auth.ts`, `user.ts`, `board.ts`, `list.ts`, `packages/shared/src/index.ts`

---

## Work Package 4: Documentation Fixes (Low)

**Goal:** Fix spec inaccuracies and commit pending changes.

### Tasks

- [ ] **4a.** In `docs/specs/00-project-overview.md`, change "Node.js 22 LTS" to "Node.js 25"
- [ ] **4b.** In `docs/specs/05-frontend-components.md`, update the archive icon description to say "visible on hover over board header" (matching actual behavior)
- [ ] **4c.** Standardize naming: pick either "ArchivedBoardsSection" or "ArchivedBoardsDrawer" and use it consistently in `05-frontend-components.md`
- [ ] **4d.** Stage and commit all pending spec changes

**Files:** `docs/specs/00-project-overview.md`, `docs/specs/05-frontend-components.md`

---

## Work Package 5: Security Hardening (Medium)

**Goal:** Add rate limiting to auth endpoints and tighten password requirements.

### Tasks

- [ ] **5a.** Install `@fastify/rate-limit`
- [ ] **5b.** Apply rate limiting to `/auth/login` and `/auth/register` routes (e.g., 10 attempts per minute per IP)
- [ ] **5c.** Update password schema min length from 8 to 12 in `packages/shared/src/validation/auth.ts`
- [ ] **5d.** Update the register form and any error messages referencing the old minimum
- [ ] **5e.** Add tests for rate limiting behavior

**Files:** `packages/api/src/app.ts`, `packages/api/src/routes/auth/index.ts`, `packages/shared/src/validation/auth.ts`, `packages/web/src/routes/register/+page.svelte`

---

## Work Package 6: Accessibility Improvements (Medium)

**Goal:** Improve keyboard navigation and screen reader support.

### Tasks

- [ ] **6a.** Add `role="alert"` to error message containers in `login/+page.svelte`, `register/+page.svelte`, and `settings/+page.svelte`
- [ ] **6b.** Add `aria-live="polite"` to dynamic content areas (archived items panel, success/error notifications)
- [ ] **6c.** Add missing `aria-label` attributes to icon-only buttons (logout button in `+layout.svelte`)
- [ ] **6d.** Make inline editing keyboard-accessible: allow Enter key on board names, list names, and card titles to enter edit mode (in addition to existing double-click)
- [ ] **6e.** Document that drag-and-drop keyboard reordering is a known gap (svelte-dnd-action limitation) — add to a future plan if desired

**Files:** `packages/web/src/routes/login/+page.svelte`, `register/+page.svelte`, `settings/+page.svelte`, `+layout.svelte`, `boards/[boardId]/+page.svelte`

---

## Work Package 7: Minor Code Quality (Low)

**Goal:** Address remaining lower-priority findings.

### Tasks

- [ ] **7a.** In `packages/api/src/routes/auth/index.ts:42`, improve error type checking: use `'code' in err` instead of unsafe cast to `NodeJS.ErrnoException`
- [ ] **7b.** In `packages/web/src/lib/api.ts:36`, give the silent `.catch(() => ({}))` on `response.json()` a proper fallback with error code
- [ ] **7c.** In `packages/api/src/services/card.service.ts:40`, replace `Record<string, unknown>` with `Partial<typeof cards.$inferInsert>` or equivalent typed approach
- [ ] **7d.** In the board page drag-and-drop catch blocks, show an error message to the user instead of silently refreshing

**Files:** `packages/api/src/routes/auth/index.ts`, `packages/web/src/lib/api.ts`, `packages/api/src/services/card.service.ts`, `packages/web/src/routes/boards/[boardId]/+page.svelte`

---

## Suggested Execution Order

1. **WP1** (auth middleware) — critical, small scope, no dependencies
2. **WP2** (validation/auth helpers) — builds on WP1's type fix
3. **WP3** (unused code) — independent, quick wins
4. **WP4** (docs) — independent, quick wins
5. **WP5** (rate limiting) — independent, medium effort
6. **WP6** (accessibility) — independent, medium effort
7. **WP7** (minor quality) — sweep up remaining items

WP1–WP4 can likely be done in one session. WP5–WP7 are independent of each other and can be parallelized.
