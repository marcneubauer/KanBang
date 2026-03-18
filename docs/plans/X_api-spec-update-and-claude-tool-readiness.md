# Plan: API Spec Update & Claude Tool Readiness

## Context

The REST API spec (03-rest-api.md) has drifted from the implementation and is missing endpoints that would make the API useful as an MCP tool for Claude. This plan covers both spec corrections and new endpoints.

## Changes

### ~~1. Spec Corrections — Update `docs/specs/03-rest-api.md`~~ ✅ Done

**1a. Add `completed` field to cards** ✅
**1b. Fix passkey route paths** ✅
**1c. Add missing passkey endpoints to spec** ✅
**1d. Add health endpoint** ✅

### ~~2. New Route: GET /api/v1/cards/:cardId~~ ✅ Done

### ~~3. New Route: GET /api/v1/lists/:listId~~ ✅ Done

### ~~4. New Route: GET /api/v1/boards/:boardId/cards/search~~ ✅ Done

### ~~5. Integration Tests~~ ✅ Done

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `docs/specs/03-rest-api.md` | Spec corrections + new endpoint docs | ✅ |
| `packages/api/src/routes/cards/index.ts` | Add GET /:cardId | ✅ |
| `packages/api/src/routes/lists/index.ts` | Add GET /:listId | ✅ |
| `packages/api/src/routes/boards/index.ts` | Add GET /:boardId/cards/search | ✅ |
| `packages/api/src/services/card.service.ts` | Add search() method | ✅ |
| `packages/api/src/services/list.service.ts` | Add getByIdWithCards() method | ✅ |
| `packages/shared/src/validation/card.ts` | Add searchCardsSchema | ✅ |
| `packages/api/tests/integration/cards.test.ts` | Tests for GET card + search | ✅ |
| `packages/api/tests/integration/lists.test.ts` | Tests for GET list | ✅ |

## Verification

1. `pnpm typecheck` — no type errors ✅
2. `pnpm test` — all 136 tests pass ✅
3. Manual: test search with `curl` against dev server
