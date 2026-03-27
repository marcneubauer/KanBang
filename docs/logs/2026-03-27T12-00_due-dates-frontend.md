# Session Log — 2026-03-27 12:00

## Goal
Implement due dates feature on the frontend side only.

## Actions Taken

### 1. Created due date utility (`packages/web/src/lib/utils/due-date.ts`)
- `getDueDateStatus()` — returns a status string (none/neutral/soon/overdue/complete) based on time remaining
- `formatDueDate()` — formats a date for display (short month + day, year only if different)

### 2. Created DatePicker component (`packages/web/src/lib/components/DatePicker.svelte`)
- Svelte 5 component using `$props()` and `$state()`
- Uses native `<input type="date">` in an absolute-positioned popover
- Supports setting and removing due dates
- Closes on Escape key, auto-focuses the input
- Converts dates to noon UTC ISO strings to avoid timezone issues

### 3. Updated board page (`packages/web/src/routes/boards/[boardId]/+page.svelte`)
- Added `dueDate: string | null` to `CardItem` interface
- Added `setCardDueDate()` function to PATCH card due dates via API
- Added `datePickerCardId` state to track which card's date picker is open
- Added calendar icon button on each card (visible on hover) to toggle date picker
- Added due date badge below card title with color-coded status (neutral/soon/overdue/complete)
- Added `flex-wrap: wrap` and `position: relative` to `.card-item` for badge layout
- Added CSS for `.card-due-date-btn`, `.due-date-badge`, and status color classes

## Files Created
- `packages/web/src/lib/utils/due-date.ts`
- `packages/web/src/lib/components/DatePicker.svelte`

## Files Modified
- `packages/web/src/routes/boards/[boardId]/+page.svelte`

## Verification
- `pnpm typecheck` passes with 0 errors (7 warnings are all pre-existing)
