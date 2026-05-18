# Session Log — 2026-03-25 15:00

## Goal

Execute Work Package 5 (Security Hardening) from the code review plan.

## Actions Taken

### 5a. Install @fastify/rate-limit
- Ran `pnpm --filter @kanbang/api add @fastify/rate-limit`; package was already in the lockfile from a prior worktree attempt, so it resolved instantly.

### 5b. Register rate-limit plugin in app.ts
- Added `import rateLimit from '@fastify/rate-limit'` and registered it with `{ global: false }` so it only applies where explicitly configured.

### 5c. Apply route-level rate limiting to auth routes
- Added `authRateLimit` config object (10 requests per minute) to both `/register` and `/login` POST routes in `packages/api/src/routes/auth/index.ts`.

### 5d. Update password schema min length
- Changed `z.string().min(8)` to `z.string().min(12)` in `packages/shared/src/validation/auth.ts`.

### 5e. Update register form minlength attribute
- Changed `minlength="8"` to `minlength="12"` in `packages/web/src/routes/register/+page.svelte`.

### 5f. Update test helpers password
- Changed default password from `'password123'` to `'password12345'` in `packages/api/tests/integration/helpers.ts`.

### 5g. Update validation test fixtures
- Updated all password fixtures in `packages/shared/src/validation/__tests__/schemas.test.ts` to use `'password12345'` (13 chars).
- Updated the "rejects short password" test to use `'only11chars'` (11 chars, just under the new 12-char minimum).

### 5h. Rate-limit integration tests
- File `packages/api/tests/integration/rate-limit.test.ts` already existed from a prior attempt with good coverage (5 tests). Verified all pass.

## Verification

- `pnpm typecheck`: 0 errors across all packages
- `pnpm test`: 153/154 tests pass; 1 pre-existing failure in `web/tests/api.test.ts` unrelated to WP5 (error code mismatch from a prior work package's API client changes)

## Files Modified

| File | Change |
|------|--------|
| `packages/api/package.json` | Added `@fastify/rate-limit` dependency |
| `packages/api/src/app.ts` | Imported and registered rate-limit plugin with `global: false` |
| `packages/api/src/routes/auth/index.ts` | Added rate-limit config to login and register routes |
| `packages/shared/src/validation/auth.ts` | Password min length 8 -> 12 |
| `packages/web/src/routes/register/+page.svelte` | minlength attribute 8 -> 12 |
| `packages/api/tests/integration/helpers.ts` | Default test password updated to 13 chars |
| `packages/shared/src/validation/__tests__/schemas.test.ts` | Test fixtures updated for new min length |
