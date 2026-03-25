# Plan: Board UI Tweaks

## Goal

Clean up the board archive/visibility UX across the boards listing page and the board page.

## Current State

- **Boards listing page** (`boards/+page.svelte`):
  - Each board card has a wastebasket icon for archiving (top-right, hover-to-show)
  - "Show archived boards" is a text toggle (`▸ Show archived boards`) at the bottom in its own section
  - "Create Board" button is in the page header

- **Board page** (`boards/[boardId]/+page.svelte`):
  - "Archive Board" is a text button in the board header, always visible
  - Board name is editable via double-click (inline input appears)
  - Archive button is separate from the name editing flow

## Changes

### 1. Remove archive button from board cards on the listing page

**File:** `packages/web/src/routes/boards/+page.svelte`

- Delete the `<button class="board-archive">` and its wastebasket SVG from inside each `.board-card` (lines 89-104)
- Delete the `.board-archive` CSS styles
- Remove the `archiveBoard()` function (no longer needed on this page)
- Rationale: archiving a board is a significant action — it should only be available from within the board itself, not from a quick hover on the picker card

### 2. Move archive button into the board name edit state on the board page

**File:** `packages/web/src/routes/boards/[boardId]/+page.svelte`

- Remove the always-visible "Archive Board" text button from the header (line 295)
- Add a wastebasket icon button **to the right of the board name input** that only appears when `editingBoardName` is true (i.e., after double-clicking the board name)
- Use the same wire wastebasket SVG already used for lists/cards, sized at `width="14" height="14"`
- Layout: the edit state becomes `[input] [wastebasket]` in a flex row
- The wastebasket triggers `archiveBoard()` as before
- Delete the `.btn-archive-board` CSS styles, add new styles for the inline icon button

### 3. Replace "Show archived boards" text with an eye icon next to "Create Board"

**File:** `packages/web/src/routes/boards/+page.svelte`

- Remove the `<div class="archived-section">` toggle button at the bottom
- Add a **closed-eye icon button** next to the "+ Create Board" button in the page header
- When clicked, it toggles `showArchivedBoards` (same behavior as the current text toggle)
- When archived boards are visible, the icon switches to an **open-eye icon**
- The archived boards drawer stays in the same position (below the board grid)
- Delete the `.archived-section` and `.archived-toggle` CSS, add icon button styles in the header

### 4. Design the eye icons (open/closed) as inline SVGs

Create two line-art eye SVGs to use inline:

**Open eye** (archived boards visible):
```svg
<svg viewBox="0 0 16 16" width="16" height="16"
  fill="none" stroke="currentColor" stroke-width="1.2"
  stroke-linecap="round" stroke-linejoin="round">
  <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
  <circle cx="8" cy="8" r="2"/>
</svg>
```

**Closed eye** (archived boards hidden — default state):
```svg
<svg viewBox="0 0 16 16" width="16" height="16"
  fill="none" stroke="currentColor" stroke-width="1.2"
  stroke-linecap="round" stroke-linejoin="round">
  <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
  <circle cx="8" cy="8" r="2"/>
  <line x1="2" y1="14" x2="14" y2="2"/>
</svg>
```

These match the existing icon style (line art, no fill, `stroke-width="1.2"`).

## Decision: Eye icon vs wastebasket for archive action

Keep them separate:

- **Wastebasket** = destructive action (archive/remove something). Used for: archive board, archive list, archive card
- **Eye (closed/open)** = visibility toggle (show/hide archived items). Used for: toggling the archived boards drawer

### 5. Update spec: `docs/specs/05-frontend-components.md`

**Board List Page component tree** (lines 34-48) — update to reflect:
- `BoardCard` no longer has an archive action
- `ArchivedBoardsSection` toggle moves from a separate collapsed section to an eye icon button in `PageHeader`

Replace:
```
BoardListPage
├── PageHeader ("Your Boards" + Create Board button)
├── BoardGrid
│   └── BoardCard (repeated)
│       ├── Board name
│       └── Created date
├── CreateBoardModal (shown on button click)
│   ├── Name input
│   └── Create / Cancel buttons
└── ArchivedBoardsSection (collapsed by default)
    └── ArchivedBoardCard (repeated)
        ├── Board name
        └── Unarchive button
```
With:
```
BoardListPage
├── PageHeader ("Your Boards" + Create Board button + eye icon toggle)
├── BoardGrid
│   └── BoardCard (repeated)
│       └── Board name
├── CreateBoardModal (shown on button click)
│   ├── Name input
│   └── Create / Cancel buttons
└── ArchivedBoardsDrawer (shown when eye icon is open)
    └── ArchivedBoardCard (repeated)
        ├── Board name
        └── Unarchive button
```

**Board Detail Page component tree** (lines 50-57) — update `BoardHeader` to reflect archive icon appearing only during name editing:

Replace:
```
BoardDetailPage
├── BoardHeader
│   ├── Board name (editable inline)
│   └── Board actions menu (... button)
│       └── Archive board
```
With:
```
BoardDetailPage
├── BoardHeader
│   ├── Board name (editable inline, double-click to edit)
│   └── Archive icon (wastebasket, visible only during name edit)
```

**ArchivedBoardsSection spec** (lines 97-101) — update to describe the eye icon toggle:

Replace the behavior description:
> Collapsed by default; shows a "Show archived boards" toggle link. On expand, fetches...

With:
> Toggled via the eye icon button in the page header. Closed-eye icon (default) means archived boards are hidden; open-eye icon means they are visible. On first toggle, fetches `GET /api/v1/boards?archived=true` and renders archived board cards below the active board grid. Subsequent toggles show/hide without re-fetching.

**BoardCard spec** (lines 92-95) — no change needed (spec already doesn't mention archive on the card).

## Implementation Order

1. Design the eye SVGs and verify they look right
2. Change 3 — move the archived-boards toggle to an eye icon in the header
3. Change 1 — remove archive button from board cards
4. Change 2 — move archive button into board name edit state
5. Change 5 — update `05-frontend-components.md` spec
6. Verify all archive/unarchive flows still work end-to-end
