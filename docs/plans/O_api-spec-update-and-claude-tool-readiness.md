# Plan: API Spec Update & Claude Tool Readiness

## Context

The REST API spec (03-rest-api.md) has drifted from the implementation and is missing endpoints that would make the API useful as an MCP tool for Claude. This plan covers both spec corrections and new endpoints.

## Changes

### 1. Spec Corrections — Update `docs/specs/03-rest-api.md`

These are documentation-only changes to match what's already implemented:

**1a. Add `completed` field to cards**
- Add `completed: false` to card create response examples
- Add `completed: z.boolean().optional()` to PATCH card validation
- Show `completed` field in all card object examples

**1b. Fix passkey route paths**
- Change `/api/v1/auth/passkey/register/options` → `/api/v1/passkeys/register/options`
- Change `/api/v1/auth/passkey/register/verify` → `/api/v1/passkeys/register/verify`
- Change `/api/v1/auth/passkey/login/options` → `/api/v1/passkeys/login/options`
- Change `/api/v1/auth/passkey/login/verify` → `/api/v1/passkeys/login/verify`
- Rename section from "Auth Endpoints" subsection to its own "Passkey Endpoints" section

**1c. Add missing passkey endpoints to spec**
- `GET /api/v1/passkeys` — list user's passkeys (id, deviceType, backedUp, createdAt)
- `DELETE /api/v1/passkeys/:credentialId` — delete a passkey

**1d. Add health endpoint**
- `GET /api/v1/health` — returns `{ status: "ok" }`

### 2. New Route: GET /api/v1/cards/:cardId

**Why:** Claude needs to retrieve a single card to read its current state before making updates (e.g. checking description content, completed status). Without this, the only way to see a card is to fetch the entire board.

**Files:**
- `packages/api/src/routes/cards/index.ts` — add GET handler, reuse `cardService.getById()`
- `docs/specs/03-rest-api.md` — document endpoint

**Response (200):**
```json
{
  "card": {
    "id": "card1",
    "title": "My Task",
    "description": "...",
    "listId": "list1",
    "position": "a0",
    "completed": false,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### 3. New Route: GET /api/v1/lists/:listId

**Why:** Claude needs to see a single list and its cards without fetching the full board. Useful for targeted operations like "what cards are in the To Do list?"

**Files:**
- `packages/api/src/routes/lists/index.ts` — add GET handler, reuse `listService.getById()` + fetch cards
- `packages/api/src/services/list.service.ts` — add `getByIdWithCards()` method that joins cards sorted by position
- `docs/specs/03-rest-api.md` — document endpoint

**Response (200):**
```json
{
  "list": {
    "id": "list1",
    "name": "To Do",
    "boardId": "board1",
    "position": "a0",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z",
    "cards": [
      {
        "id": "card1",
        "title": "First task",
        "description": null,
        "position": "a0",
        "completed": false
      }
    ]
  }
}
```

### 4. New Route: GET /api/v1/boards/:boardId/cards/search

**Why:** Claude needs to find cards by text or filter by status without scanning every list. Essential for questions like "which cards are completed?" or "find the card about deployment".

**Files:**
- `packages/api/src/routes/boards/index.ts` — add GET handler under boards prefix
- `packages/api/src/services/card.service.ts` — add `search(boardId, query)` method
- `packages/shared/src/validation/card.ts` — add `searchCardsSchema` for query params
- `docs/specs/03-rest-api.md` — document endpoint

**Query parameters:**
- `q` (optional): text search in title and description (case-insensitive LIKE)
- `completed` (optional): `true` or `false` filter

**Response (200):**
```json
{
  "cards": [
    {
      "id": "card1",
      "title": "Deploy to prod",
      "description": "...",
      "listId": "list1",
      "listName": "In Progress",
      "position": "a0",
      "completed": false,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

Note: includes `listName` so Claude can contextualize which list each card belongs to without extra lookups.

### 5. Integration Tests

**File:** `packages/api/tests/integration/`

- GET single card — returns card, 404 for missing, 404 for other user's card
- GET single list with cards — returns list + cards sorted by position, 404 for missing
- Search cards — text match, completed filter, combined filters, empty results

## Files Modified

| File | Change |
|------|--------|
| `docs/specs/03-rest-api.md` | Spec corrections + new endpoint docs |
| `packages/api/src/routes/cards/index.ts` | Add GET /:cardId |
| `packages/api/src/routes/lists/index.ts` | Add GET /:listId |
| `packages/api/src/routes/boards/index.ts` | Add GET /:boardId/cards/search |
| `packages/api/src/services/card.service.ts` | Add search() method |
| `packages/api/src/services/list.service.ts` | Add getByIdWithCards() method |
| `packages/shared/src/validation/card.ts` | Add searchCardsSchema |
| `packages/api/tests/integration/cards.test.ts` | Tests for GET card + search |
| `packages/api/tests/integration/lists.test.ts` | Tests for GET list |

## Verification

1. `pnpm typecheck` — no type errors
2. `pnpm test` — all tests pass including new ones
3. Manual: test search with `curl` against dev server
