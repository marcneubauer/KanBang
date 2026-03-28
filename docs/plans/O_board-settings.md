# Plan: Board Settings Modal

## Context

Several upcoming features require board-level configuration: Done list designation, background images, and potentially others. Rather than adding ad-hoc UI for each, create a board settings modal that serves as the centralized place for board configuration.

**This is a prerequisite for:** Done column (`O_done-column.md`), background images (future).

---

## Design Decisions

### Modal triggered from board header

A settings gear icon in the board header opens the modal. The modal contains tabs or sections for different settings categories.

### Initial settings sections

For the first implementation, the modal needs at minimum:

1. **General** — Board name (rename), delete board
2. **Done list** — Dropdown to select which list is the Done list (or "None")
3. **Appearance** — Background image/color (placeholder for now, implemented later)

### API: board-level settings

Settings that are board-scoped (like Done list) use existing or new endpoints on the board/list resources. No new "settings" table needed initially — `isDone` lives on the lists table, background image could be a column on boards.

---

## Frontend Implementation

### Board settings modal component

**File:** `packages/web/src/lib/components/BoardSettingsModal.svelte` (new)

- Receives the board data and list of lists as props
- Sections/tabs for General, Done list, Appearance
- Done list section: dropdown of list names + "None" option
- Calls the appropriate API endpoints on change

### Board header: settings button

Add a gear icon button to the board header that opens the modal.

### State management

The modal operates on current board state and calls APIs directly. On success, updates are reflected in the parent board page state.

---

## Implementation Order

1. Frontend — Board settings modal component (General section: rename board)
2. Frontend — Board header settings button
3. Frontend — Done list section (dropdown, API calls) — implemented with Done column feature
4. Frontend — Appearance section — implemented with background images feature

---

## Notes

- The modal is intentionally minimal at first. New sections are added as features require them.
- Each section's backend requirements are defined in their respective feature plans.
- The modal should be easy to extend — adding a new section should be straightforward.
