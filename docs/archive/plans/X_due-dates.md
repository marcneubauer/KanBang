# Plan: Due Dates

## Context

Add due dates to cards with visual indicators on the card face. States: neutral (far out), yellow (within 48hrs), red (overdue), green+checkmark (marked complete). This is a prerequisite for the Done column's auto-archive feature, as it introduces the background scheduling pattern reused there.

---

## Design Decisions

### Simple timestamp, no reminders yet

Store a single `dueDate` timestamp on the card. No notification/reminder system in this plan — that's a separate feature (requires email/push infrastructure). The value here is the visual indicators on the board.

### Due date status computed client-side

The API returns the raw `dueDate` timestamp. The frontend computes the visual state (neutral/yellow/red/green) based on current time and `completed` status. This avoids server-side computation on every board fetch and keeps the logic simple.

### Due date editing in card face

A small calendar/date-picker icon on the card face (visible on hover, like the archive icon). Clicking opens a date picker popover. This avoids requiring the card detail modal (which the checklists plan introduces). If the modal exists by then, due date editing should also appear there.

---

## Database Changes

### Cards table: add `dueDate` column

**File:** `packages/api/src/db/schema/cards.ts`

```sql
due_date INTEGER  -- timestamp, NULL = no due date
```

Nullable, no default. Add after `completed` column.

### Migration

Run `pnpm db:generate`.

---

## Shared Types

### `packages/shared/src/types/card.ts`

Add `dueDate: Date | null` to the `Card` interface.

### `packages/shared/src/validation/card.ts`

Update schemas:

```typescript
export const createCardSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(5000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  description: z.string().max(5000).nullable().optional(),
  completed: z.boolean().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});
```

Using `z.coerce.date()` so both ISO strings and Date objects are accepted. `.nullable()` allows explicitly clearing the due date by sending `null`.

---

## API Changes

### Card create/update

No new endpoints. The existing `POST /api/v1/lists/:listId/cards` and `PATCH /api/v1/cards/:cardId` endpoints already accept partial bodies validated by Zod. Adding `dueDate` to the schemas is sufficient.

### Card service

**File:** `packages/api/src/services/card.service.ts`

In `create()`: pass `dueDate` through if provided.

In `update()`: add `if (input.dueDate !== undefined) updates.dueDate = input.dueDate;`

### Board detail response

`dueDate` is already included automatically — the board service selects all card columns.

---

## Frontend Changes

### Due date status logic

**File:** `packages/web/src/lib/utils/due-date.ts` (new)

```typescript
export type DueDateStatus = 'none' | 'neutral' | 'soon' | 'overdue' | 'complete';

export function getDueDateStatus(
  dueDate: Date | string | null,
  completed: boolean,
): DueDateStatus {
  if (!dueDate) return 'none';
  if (completed) return 'complete';

  const now = new Date();
  const due = new Date(dueDate);
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilDue < 0) return 'overdue';
  if (hoursUntilDue < 24) return 'soon';
  return 'neutral';
}

export function formatDueDate(dueDate: Date | string): string {
  const due = new Date(dueDate);
  const now = new Date();
  const isThisYear = due.getFullYear() === now.getFullYear();
  return due.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isThisYear ? {} : { year: 'numeric' }),
  });
}
```

### Card face: due date badge

**File:** `packages/web/src/routes/boards/[boardId]/+page.svelte`

Below the card title (next to checklist progress if it exists), show a due date badge when `card.dueDate` is set:

```html
{#if card.dueDate}
  <span class="due-date-badge due-date-{getDueDateStatus(card.dueDate, card.completed)}">
    🕐 {formatDueDate(card.dueDate)}
  </span>
{/if}
```

CSS classes:
- `.due-date-neutral` — default text color, subtle background
- `.due-date-soon` — yellow/amber background (`#fef3c7`), dark text
- `.due-date-overdue` — red background (`#fee2e2`), dark red text
- `.due-date-complete` — green background (`#dcfce7`), checkmark icon, dark green text

### Card face: date picker trigger

Add a calendar icon button to the card hover actions (alongside the existing archive icon). On click, open a date picker popover positioned near the card.

### Date picker popover

**File:** `packages/web/src/lib/components/DatePicker.svelte` (new)

Simple date picker component:
- Native `<input type="date">` wrapped in a styled popover (keeps it simple, works cross-browser)
- "Remove due date" button to clear
- On change, calls `PATCH /api/v1/cards/:cardId` with `{ dueDate }` or `{ dueDate: null }`
- Closes on blur/escape

### CardItem interface update

Add `dueDate: string | null` to the `CardItem` interface in the board page.

### Updated `toggleCardCompleted`

When a card is completed and has a due date, the badge should switch to green. This happens automatically since `getDueDateStatus` checks the `completed` flag.

---

## Integration Tests

**File:** `packages/api/tests/integration/cards.test.ts` (extend existing)

New test cases:
- Create card with due date
- Update card to set due date
- Update card to clear due date (`null`)
- Due date included in board detail response
- Due date included in single card response
- Create card without due date → `dueDate: null`

---

## E2E Tests

**File:** `e2e/due-dates.spec.ts` (new)

- Hover card → calendar icon appears
- Click calendar icon → date picker opens
- Set due date → badge appears on card face
- Set due date to tomorrow → yellow badge
- Set due date to yesterday → red badge
- Mark card complete → green badge
- Remove due date → badge disappears

---

## Implementation Order

1. DB migration — add `dueDate` to cards
2. Shared types + validation schemas
3. Card service — pass `dueDate` through in create/update
4. Integration tests
5. Due date status utility (`due-date.ts`)
6. Date picker component
7. Card face badge + hover action
8. E2E tests
