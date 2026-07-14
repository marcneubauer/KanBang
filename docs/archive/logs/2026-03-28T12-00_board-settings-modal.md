# Session Log — 2026-03-28 12:00

## Goal

Refine the Done column plan and implement the board settings modal as a prerequisite.

## Work Done

### 1. Done Column Plan Refinement

Updated `docs/plans/O_done-column.md` based on discussion:

| Decision | Choice |
|----------|--------|
| Auto-archive | Page-load time (in board detail endpoint), not background job |
| Done list UX | Board settings modal dropdown, not per-list menu |
| Archive protection | API returns error if trying to archive a Done-designated list |
| Reordering | Drag-reorder disabled for Done list in UI |
| Collapse default | Collapsed by default, user choice persisted in localStorage |

### 2. Board Settings Plan

Created `docs/plans/O_board-settings.md` — board-level config modal as prerequisite for Done column and future features (background images).

### 3. Board Settings Modal Implementation

- **New file:** `packages/web/src/lib/components/BoardSettingsModal.svelte`
  - Board name rename (save on blur/Enter)
  - Archive board with inline confirmation
  - Same modal pattern as CardDetailModal
- **Modified:** `packages/web/src/routes/boards/[boardId]/+page.svelte`
  - Added gear icon button in board header
  - Wrapped header actions in `.board-header-actions` container
  - Modal toggle via `showSettings` state

### Key Decisions

- No backend changes needed — reuses existing PATCH /boards/:boardId and PATCH /boards/:boardId/archive endpoints
- Modal is intentionally minimal — Done list selector and Appearance sections added by their respective features
- Archive button kept in header alongside gear icon (not moved into modal exclusively)

## Files Created/Modified

| File | Action |
|------|--------|
| `docs/plans/O_done-column.md` | Updated with refined decisions |
| `docs/plans/O_board-settings.md` | Created |
| `packages/web/src/lib/components/BoardSettingsModal.svelte` | Created |
| `packages/web/src/routes/boards/[boardId]/+page.svelte` | Modified (gear icon, modal) |
