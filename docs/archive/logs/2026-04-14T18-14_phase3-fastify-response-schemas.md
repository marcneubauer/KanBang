# Session Log — 2026-04-14 18:14

## Goal

Implement Phase 3 of the Fastify schema plan: activate `fast-json-stringify` on all API routes by adding Fastify response schemas. Purely additive — no service/business logic changes.

## Prompts and Actions

### Single prompt: implement Phase 3

1. **Read all relevant files** — `db/schema/*.ts`, `app.ts`, all route files (`boards`, `lists`, `cards`, `checklists`, `auth`, `passkeys`), and service files to understand what data shapes are returned.

2. **Created `packages/api/src/schemas/index.ts`** — plain JSON Schema objects (`as const`) for: `userSchema`, `boardSchema`, `listSchema`, `cardSchema`, `checklistSchema`, `checklistItemSchema`. Exported `allSchemas` array.

3. **Updated `packages/api/src/app.ts`** — imported `allSchemas` and registered each with `app.addSchema()` after `authPlugin`, before route registration.

4. **Updated all route files** — added `schema: { response: { N: ... } }` to every route handler:
   - `boards/index.ts` — 8 routes; complex nested inline schemas for board detail (lists+cards+checklistProgress), archived items, and a custom `cardSearchResultSchema` that includes `listName`
   - `lists/index.ts` — 7 routes; inline `listWithCardsResponse` for GET single list
   - `cards/index.ts` — 7 routes; references `card#`
   - `checklists/index.ts` — 10 routes; inline `checklistWithItemsSchema` for create and list endpoints (service returns `items` array)
   - `auth/index.ts` — 4 routes; added error status codes (400, 401, 409) to register/login to satisfy TypeScript's Fastify generic narrowing
   - `passkeys/index.ts` — 6 routes; inline passkey list schema; generic object schema for WebAuthn options; error status codes added for routes with direct `reply.code(N)` calls

5. **First typecheck run** revealed errors in `auth/index.ts` and `passkeys/index.ts` — Fastify's TypeScript generics narrow `reply.code(N)` to only the status codes declared in `schema.response`. Fixed by declaring all actually-used status codes in each route's response schema.

6. **First test run** revealed 4 failures caused by `fast-json-stringify` stripping undeclared fields:
   - Checklists: `getByCardId` returns `{ ...checklist, items: [...] }` and `create` returns `{ ...checklist, items: [] }` — `items` was not in `checklistSchema`. Fixed with inline `checklistWithItemsSchema`.
   - Card search: `search()` returns a custom projection with `listName` (no `archivedAt`/`completedAt`). Fixed with inline `cardSearchResultSchema`.

7. **Final typecheck and tests**: 0 TypeScript errors, 192/192 tests passing.

## Files Created or Modified

| File | Action |
|------|--------|
| `packages/api/src/schemas/index.ts` | Created — JSON Schema definitions for all entities |
| `packages/api/src/app.ts` | Modified — import `allSchemas`, register via `app.addSchema()` |
| `packages/api/src/routes/boards/index.ts` | Modified — added response schemas to all 8 routes |
| `packages/api/src/routes/lists/index.ts` | Modified — added response schemas to all 7 routes |
| `packages/api/src/routes/cards/index.ts` | Modified — added response schemas to all 7 routes |
| `packages/api/src/routes/checklists/index.ts` | Modified — added response schemas to all 10 routes |
| `packages/api/src/routes/auth/index.ts` | Modified — added response schemas to all 4 routes |
| `packages/api/src/routes/passkeys/index.ts` | Modified — added response schemas to all 6 routes |

## Key Decisions

- **Plain JSON Schema objects, not TypeBox** — as specified; no new dependencies.
- **Inline schemas for non-trivial shapes** — rather than polluting `schemas/index.ts` with every response variant, complex nested shapes (board detail, list+cards, checklist+items, card search results) are defined inline in the route files where they're used.
- **`checklistWithItemsSchema` instead of `checklist#` ref** — both the create and list endpoints return checklists with a nested `items` array (service always populates it); using the base `checklist#` schema would strip items. This is intentional: `checklist#` is still useful for routes that only return the base checklist (patch, reorder).
- **`cardSearchResultSchema`** — the search endpoint returns a custom join projection with `listName` and without some card fields; it cannot reuse `card#`.
- **Error status codes in auth/passkeys schemas** — required to satisfy Fastify's TypeScript generics when handlers call `reply.code(400/401/409)` directly in the handler body (rather than delegating to `validateBody`).
