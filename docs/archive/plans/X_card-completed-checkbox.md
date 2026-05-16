# Plan: Card "Completed" Checkbox

## Context
Add a completed status field and square checkbox to each card, similar to Trello's task completion UI. The checkbox shows on hover when unchecked and is always visible when checked. Completed card titles are dimmed.

## Changes

### 1. Database Schema
**File:** `packages/api/src/db/schema/cards.ts`
- Add `completed` column: `integer('completed', { mode: 'boolean' }).notNull().default(false)`
- Place after `position`, before `createdAt`
- Run `pnpm db:generate` to create migration (will produce `ALTER TABLE cards ADD COLUMN completed integer NOT NULL DEFAULT 0`)

### 2. Shared Types
**File:** `packages/shared/src/types/card.ts`
- Add `completed: boolean` to `Card` interface

### 3. Shared Validation
**File:** `packages/shared/src/validation/card.ts`
- Add `completed: z.boolean().optional()` to `updateCardSchema`
- No change to `createCardSchema` (defaults to false)

### 4. API Service
**File:** `packages/api/src/services/card.service.ts`
- In `update()` method (line 42), add: `if (input.completed !== undefined) updates.completed = input.completed;`
- No other method changes needed — queries use `select()` which returns all columns automatically

### 5. Frontend UI
**File:** `packages/web/src/routes/boards/[boardId]/+page.svelte`

**5a. CardItem interface** — add `completed: boolean`

**5b. Toggle function** — add `toggleCardCompleted(cardId, listId, completed)` that PATCHes `/cards/${cardId}` with `{ completed }` and updates local state

**5c. Card template** (line 260, inside `.card-item`, before the title span) — add checkbox button:
- Square SVG checkbox (16x16)
- When checked: green filled square (`#22c55e`) with white checkmark path, always visible
- When unchecked: gray bordered square, hidden by default
- `onclick` with `e.stopPropagation()` to prevent drag interference

**5d. CSS** — follow existing `.card-delete` hover-reveal pattern:
- `.card-checkbox` — `opacity: 0`, transition 150ms
- `.card-checkbox-checked` — `opacity: 1` (always visible)
- `.card-item:hover .card-checkbox` — `opacity: 1`
- Completed title dimming: `.card-title-completed { opacity: 0.6; }`

### 6. Integration Tests
**File:** `packages/api/tests/integration/cards.test.ts`
- New cards default to `completed: false`
- PATCH with `{ completed: true }` works
- Toggle back to false works
- `completed` field present in board fetch response

### 7. E2E Tests
**File:** `e2e/lists-and-cards.spec.ts`
- Hover card → checkbox appears
- Click checkbox → checked state, stays visible without hover
- Click again → unchecked

## Verification
1. `pnpm db:generate` — verify migration SQL
2. `pnpm typecheck` — no type errors
3. `pnpm test` — all integration tests pass
4. `pnpm dev` — manually verify checkbox hover/click behavior
5. `pnpm test:e2e` — E2E tests pass
