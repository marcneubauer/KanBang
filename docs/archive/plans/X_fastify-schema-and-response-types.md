# Fastify Schema Validation & Typed API Responses

## Context

An audit of `@kanbang/api` against the `fastify-best-practices` skill revealed two related gaps:

1. **No Fastify-native response schemas** — all responses use slow `JSON.stringify` instead of `fast-json-stringify`. The `schema:` option is never used on any route, so AJV validation and fast serialization are both bypassed.
2. **Web API responses are untyped** — `+page.server.ts` files call `res.json()` returning `any`. The shared `types/*.ts` interfaces (`Board`, `Card`, `List`) exist but are never imported by the web. There is also a latent type bug: those interfaces declare `createdAt: Date` but `JSON.parse` always returns a `string`.

**Chosen approach: Option B — Zod as the single schema language across both packages.**

- Keep Zod for input validation (already working, keep `validateBody` util for now)
- Add Zod *response* schemas to `@kanbang/shared` — one source of truth for entity shapes
- Web uses those schemas to type + runtime-validate API responses (fixes the Date bug)
- API adds Fastify response schemas (plain JSON Schema) to activate `fast-json-stringify` — additive, doesn't remove Zod

This avoids introducing TypeBox as a second schema library. The two schema systems serve different purposes and don't conflict: Zod for shared type contracts, JSON Schema for Fastify serialization performance.

---

## Phase 1 — Shared: Add Zod Response Schemas

**Files:** `packages/shared/src/types/*.ts`, `packages/shared/src/validation/*.ts`

Replace the hand-written interfaces in `types/*.ts` with types *derived* from Zod response schemas. Dates become `z.string().datetime()` (what JSON actually returns) instead of `z.date()`.

### `packages/shared/src/validation/board.ts`

Add alongside existing input schemas:

```ts
export const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export type Board = z.infer<typeof boardSchema>;

export const boardsResponseSchema = z.object({ boards: z.array(boardSchema) });
export const boardResponseSchema   = z.object({ board: boardSchema });
```

### `packages/shared/src/validation/list.ts`

```ts
export const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  boardId: z.string(),
  position: z.string(),
  isDone: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export type List = z.infer<typeof listSchema>;

// List with its cards (used by GET /lists/:listId)
export const listWithCardsSchema = listSchema.extend({
  cards: z.array(z.lazy(() => cardSchema)), // import from card.ts
});

export const listResponseSchema = z.object({ list: listSchema });
```

### `packages/shared/src/validation/card.ts`

```ts
export const cardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  listId: z.string(),
  position: z.string(),
  completed: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  dueDate: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export type Card = z.infer<typeof cardSchema>;
export const cardResponseSchema = z.object({ card: cardSchema });
export const cardsResponseSchema = z.object({ cards: z.array(cardSchema) });
```

### `packages/shared/src/validation/checklist.ts`

Add response schemas for `Checklist` and `ChecklistItem` similarly, deriving types from Zod.

### `packages/shared/src/types/*.ts`

Delete the hand-written interface files. Replace with re-exports from the validation files:

```ts
// types/board.ts — becomes:
export type { Board } from '../validation/board.js';
```

Or remove `types/*.ts` entirely and update imports to come directly from `validation/*.ts`.

### `packages/shared/src/index.ts`

Export all response schemas and types from the barrel.

---

## Phase 2 — Web: Type & Validate API Responses

**Files:** `packages/web/src/routes/**/*.server.ts`, `packages/web/src/lib/api.ts`

### `lib/api.ts` — optional schema parameter

Extend the generic `api<T>()` helper to accept an optional Zod schema for response parsing:

```ts
import type { ZodType } from 'zod';

export async function api<T>(
  path: string,
  options: RequestInit = {},
  schema?: ZodType<T>,
  fetchFn: typeof fetch = fetch,
): Promise<T> {
  // ... existing fetch logic ...
  const data = await response.json();
  return schema ? schema.parse(data) : data as T;
}
```

### `+page.server.ts` files — use response schemas

Replace untyped `res.json()` calls with Zod-parsed responses:

```ts
// Before
const { boards } = await res.json();

// After
import { boardsResponseSchema } from '@kanbang/shared';
const { boards } = boardsResponseSchema.parse(await res.json());
```

For direct `fetch` calls (SSR load functions) use `schema.parse()`. For client-side `api<T>()` calls in `.svelte` files, pass the schema as the third argument.

The Zod parse errors will surface as 500s in SvelteKit's error boundary if the API ever returns an unexpected shape — which is the correct behavior.

---

## Phase 3 — API: Add Fastify Response Schemas

**Files:** `packages/api/src/routes/**/*.ts`, `packages/api/src/app.ts`

This phase is independent of Phases 1 & 2 and can be done separately. The goal is activating `fast-json-stringify` for all responses without changing input validation.

### Create `packages/api/src/schemas/` directory

Define JSON Schema objects (plain objects, no TypeBox dependency) for each entity and register them globally with `app.addSchema()`.

```ts
// packages/api/src/schemas/index.ts
export const boardSchema = {
  $id: 'board',
  type: 'object',
  properties: {
    id:         { type: 'string' },
    name:       { type: 'string' },
    userId:     { type: 'string' },
    createdAt:  { type: 'string' },
    updatedAt:  { type: 'string' },
    archivedAt: { type: ['string', 'null'] },
  },
} as const;

// ... listSchema, cardSchema, etc.
```

Register in `app.ts`:

```ts
import { boardSchema, listSchema, cardSchema } from './schemas/index.js';

for (const schema of [boardSchema, listSchema, cardSchema, ...]) {
  app.addSchema(schema);
}
```

### Add `schema:` to each route

```ts
fastify.get('/', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: { boards: { type: 'array', items: { $ref: 'board#' } } },
      },
    },
  },
}, async (request) => {
  // handler unchanged
});
```

### Update `setErrorHandler` to handle `error.validation`

Currently the error handler in `app.ts` doesn't distinguish AJV validation errors. When Fastify native input validation is eventually added (future work), this handler needs to be ready:

```ts
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.validation,
    });
  }
  const statusCode = error.statusCode ?? 500;
  reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
    code: error.code ?? 'INTERNAL_ERROR',
  });
});
```

---

## Phase 4 — API: Fastify Housekeeping

Smaller improvements identified in the audit. Low risk, can be done incrementally.

### 4a. Plugin names and dependencies

```ts
// plugins/db.ts
export default fp(async (fastify, opts) => { ... }, {
  name: 'kanbang-db',
});

// plugins/auth.ts
export default fp(async (fastify) => { ... }, {
  name: 'kanbang-auth',
  dependencies: ['kanbang-db'],
});
```

### 4b. Custom `setNotFoundHandler`

```ts
app.setNotFoundHandler(async (request, reply) => {
  reply.code(404).send({ error: 'Not found', code: 'NOT_FOUND' });
});
```

### 4c. Add `@fastify/sensible`

Install `@fastify/sensible`. Register in `app.ts`. Use in routes/ownership utils instead of manual `reply.code(X).send(...)` calls.

### 4d. Refactor ownership utils to throw

Replace the boolean-return pattern with thrown errors:

```ts
// Before (every route)
if (!(await verifyBoardOwnership(boardId, user.id, boardService, reply))) return;

// After (every route)
await assertBoardOwnership(boardId, user.id, boardService);
// throws HttpError(403) or (404), caught by error handler
```

This removes the `reply` parameter from ownership utils and eliminates the awkward `if (!...) return` pattern across all route files.

---

## Files Modified

| File | Change |
|------|--------|
| `packages/shared/src/validation/board.ts` | Add `boardSchema`, `boardResponseSchema`, `Board` type |
| `packages/shared/src/validation/list.ts` | Add `listSchema`, `listResponseSchema`, `List` type |
| `packages/shared/src/validation/card.ts` | Add `cardSchema`, `cardResponseSchema`, `Card` type |
| `packages/shared/src/validation/checklist.ts` | Add response schemas + types |
| `packages/shared/src/types/*.ts` | Remove hand-written interfaces, re-export from validation |
| `packages/shared/src/index.ts` | Export new response schemas |
| `packages/web/src/lib/api.ts` | Add optional Zod schema parameter |
| `packages/web/src/routes/**/*.server.ts` | Parse API responses with Zod schemas |
| `packages/api/src/schemas/index.ts` | New file: JSON Schema entity definitions |
| `packages/api/src/app.ts` | Register schemas, update error handler, add `setNotFoundHandler` |
| `packages/api/src/routes/**/*.ts` | Add `schema: { response: ... }` to each route |
| `packages/api/src/plugins/db.ts` | Add `name` to `fp()` |
| `packages/api/src/plugins/auth.ts` | Add `name` + `dependencies` to `fp()` |
| `packages/api/src/utils/ownership.ts` | Refactor to throw instead of return bool |
| `packages/api/package.json` | Add `@fastify/sensible` |

---

## Verification

1. `pnpm typecheck` — no new errors; web components now get typed response data
2. `pnpm test` — all existing Vitest + Playwright tests pass
3. Manual: trigger a validation error, confirm response shape matches `{ error, code, details }`
4. Manual: hit a non-existent route, confirm `{ error: 'Not found', code: 'NOT_FOUND' }` instead of Fastify default
5. Manual: inspect a board API response, confirm dates are strings not Date objects

## Implementation Order

Phases are independent but logically sequenced:

```
Phase 1 (shared schemas) → Phase 2 (web types) → Phase 3 (API response schemas) → Phase 4 (housekeeping)
```

Phase 4 items can be interspersed with Phase 3 since they touch the same route files.
