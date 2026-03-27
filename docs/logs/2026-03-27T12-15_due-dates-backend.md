# Session Log — 2026-03-27 12:15

## Goal

Implement due dates for cards on the backend side: DB schema, shared types/validation, card service, and integration tests.

## Changes Made

| File | Change |
|------|--------|
| `packages/api/src/db/schema/cards.ts` | Added `dueDate` column (integer, timestamp mode, nullable) |
| `packages/shared/src/types/card.ts` | Added `dueDate: Date \| null` to `Card` interface |
| `packages/shared/src/validation/card.ts` | Added `dueDate` field to `createCardSchema` and `updateCardSchema` |
| `packages/api/src/services/card.service.ts` | Pass `dueDate` through in `create()`, `update()`, and `search()` methods |
| `packages/api/tests/integration/cards.test.ts` | Added 6 integration tests for due date CRUD and inclusion in responses |
| `packages/api/src/db/migrations/0003_numerous_wrecking_crew.sql` | Auto-generated migration: `ALTER TABLE cards ADD due_date integer` |

## Test Results

All 160 tests pass (10 test files). Typecheck passes with 0 errors.

## Key Decisions

- Used `z.coerce.date().nullable().optional()` for validation so ISO string inputs are coerced to Date objects
- Migration was auto-generated via `pnpm db:generate` (drizzle-kit)
