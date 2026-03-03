# Testability Improvements for KanBang

## Context

KanBang has ~75 automated tests (47 API integration, 16 shared unit, 19 E2E) but no CI pipeline to run them automatically, no coverage tracking, and zero frontend unit tests. The Zod schemas that define the frontend-backend contract have no direct tests. This means regressions can easily slip through — a broken import, changed validation rule, or refactored service method won't be caught until someone manually runs tests or hits the bug in production.

## Plan

### 1. GitHub Actions CI Pipeline

**New file:** `.github/workflows/ci.yml`

Trigger on push to `main` and all PRs. Single job on `ubuntu-latest` with Node 22 + pnpm:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm format:check`
5. `pnpm test:unit` (all Vitest tests)
6. `pnpm build`

Cache `~/.pnpm-store` for speed. E2E excluded from CI initially (requires running servers, slow).

### 2. Zod Schema Validation Tests

**New file:** `packages/shared/src/validation/__tests__/schemas.test.ts`

Direct tests for all 9 schemas using `schema.safeParse()`. This protects the frontend-backend contract:

- **registerSchema**: valid input, invalid email, short username, invalid username chars, short/long password, trim/lowercase transforms
- **loginSchema**: valid input, invalid email, empty password
- **createBoardSchema / updateBoardSchema**: valid name, empty name, over-length, trim transform
- **createCardSchema**: valid with/without description, empty title, over-length description
- **updateCardSchema**: partial updates, nullable description
- **moveCardSchema**: requires both listId and position
- **createListSchema / updateListSchema**: valid name, empty name, trim
- **reorderListSchema**: requires position string

~25-30 test cases, all following the same `safeParse` pattern. Already picked up by vitest workspace (`shared` entry includes `src/**/*.test.ts`).

### 3. Coverage Tracking ✅

**Status: Completed** — `@vitest/coverage-v8` installed, `test:coverage` script added, coverage config in `vitest.config.ts` (root-level, not workspace entries). Baseline: 75.6% statement coverage.

### 4. Targeted Gap Tests

#### 4a. Health endpoint test
**New file:** `packages/api/tests/integration/health.test.ts`
- `GET /api/v1/health` returns 200 with `{ status: 'ok' }`
- Protects the endpoint Docker Compose health checks depend on

#### 4b. Session expiry test
**Edit:** `packages/api/tests/integration/auth.test.ts`
- Register user, get session, directly update `expiresAt` to past date via test DB
- Assert `GET /api/v1/auth/me` returns 401
- Verify expired session row was deleted
- Tests the sliding expiry logic in `AuthService.validateSession`

#### 4c. Frontend API client tests
**New file:** `packages/web/tests/api.test.ts`

The `api()` function in `packages/web/src/lib/api.ts` accepts an injectable `fetchFn` parameter (line 18), making it trivially testable without mocking. Tests:
- Throws `ApiError` with correct `status`, `code`, `message` on non-ok response
- Falls back to `code: 'UNKNOWN'` when response body has no code field
- Falls back to `{}` when response body is not valid JSON
- Sets `Content-Type: application/json` only for string bodies
- Prepends `/api/v1` to path
- Passes `credentials: 'include'`

Need to configure path alias so `$lib/api` resolves — add `resolve.alias` to the `web` workspace entry in `vitest.workspace.ts`, or import via relative path.

#### 4d. Cascade delete verification
**Edit:** `packages/api/tests/integration/boards.test.ts`
- Create board → list → card, delete board, verify list and card are gone (GET returns 404)

## Files to Create/Modify

| File | Action |
|------|--------|
| `.github/workflows/ci.yml` | Create |
| `packages/shared/src/validation/__tests__/schemas.test.ts` | Create |
| `vitest.workspace.ts` | Edit (add coverage config + web alias) |
| `package.json` (root) | Edit (add `test:coverage` script) |
| `packages/api/tests/integration/health.test.ts` | Create |
| `packages/api/tests/integration/auth.test.ts` | Edit (add session expiry test) |
| `packages/web/tests/api.test.ts` | Create |
| `packages/api/tests/integration/boards.test.ts` | Edit (add cascade test) |

## Verification

1. `pnpm test:unit` — all existing + new tests pass
2. `pnpm typecheck` — no type errors
3. `pnpm test:coverage` — coverage report generates, review for remaining blind spots
4. Push to a branch — CI workflow runs and passes
