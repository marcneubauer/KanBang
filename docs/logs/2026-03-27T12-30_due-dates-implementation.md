# Session Log — 2026-03-27 12:30

## Goal

Implement the due dates feature per the plan in `docs/plans/O_due-dates.md`.

## Actions

### Prompt: Implement the due dates plan using agents

Read the plan and all relevant source files (schema, types, validation, service, routes, board page, integration tests, E2E helpers) to build full context. Then launched two parallel agents:

**Backend agent** handled:
- Added `dueDate` column (nullable integer timestamp) to `packages/api/src/db/schema/cards.ts`
- Generated Drizzle migration `0003_numerous_wrecking_crew.sql`
- Added `dueDate: Date | null` to Card interface in shared types
- Added `dueDate: z.coerce.date().nullable().optional()` to both create and update Zod schemas
- Updated `CardService.create()`, `update()`, and `search()` to pass dueDate through
- Added 6 integration tests (create without due date, create with, set, clear, board detail, single card)

**Frontend agent** handled:
- Created `packages/web/src/lib/utils/due-date.ts` with `getDueDateStatus()` and `formatDueDate()` utilities
- Created `packages/web/src/lib/components/DatePicker.svelte` (Svelte 5, native date input popover)
- Updated board page: added `dueDate` to CardItem, imports, `setCardDueDate()` function, `datePickerCardId` state, calendar icon button (hover), color-coded due date badge, and DatePicker integration

**Post-agent cleanup:**
- Fixed lint error (line length > 120 on onclick handler)
- Wrote E2E test file `e2e/due-dates.spec.ts` with 7 tests covering: hover shows icon, picker opens, set date shows badge, overdue = red, complete = green, remove hides badge, persistence after reload
- E2E tests couldn't run (Playwright browsers not installed) but are syntactically correct

## Verification

- 160/160 unit/integration tests pass
- 0 typecheck errors (7 pre-existing warnings)
- Lint passes clean
- Plan marked as complete (O_ -> X_)

## Files Created

| File | Purpose |
|------|---------|
| `packages/api/src/db/migrations/0003_numerous_wrecking_crew.sql` | Migration adding due_date column |
| `packages/web/src/lib/utils/due-date.ts` | Due date status logic and formatter |
| `packages/web/src/lib/components/DatePicker.svelte` | Date picker popover component |
| `e2e/due-dates.spec.ts` | E2E tests for due date feature |

## Files Modified

| File | Change |
|------|--------|
| `packages/api/src/db/schema/cards.ts` | Added dueDate column |
| `packages/shared/src/types/card.ts` | Added dueDate to Card interface |
| `packages/shared/src/validation/card.ts` | Added dueDate to create/update schemas |
| `packages/api/src/services/card.service.ts` | Pass dueDate in create, update, search |
| `packages/api/tests/integration/cards.test.ts` | 6 new due date tests |
| `packages/web/src/routes/boards/[boardId]/+page.svelte` | Calendar icon, badge, DatePicker integration |
| `docs/plans/O_due-dates.md` | Renamed to X_due-dates.md (completed) |

## Key Decisions

- Used parallel agents for backend and frontend since they touch different files (except shared types which backend handled)
- Native `<input type="date">` for the date picker — simple and cross-browser compatible per the plan
- Date stored as noon UTC (`T12:00:00Z`) to avoid timezone-related off-by-one issues
- Due date status computed client-side per plan (avoids server computation on every board fetch)
