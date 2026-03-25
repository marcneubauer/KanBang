# KanBang — Frontend Components Specification

## Page Structure

### Routes

| Route | Page | Auth Required |
|-------|------|---------------|
| `/` | Redirect to `/boards` (auth) or `/login` (no auth) | No |
| `/login` | Login form | No |
| `/register` | Registration form | No |
| `/boards` | Board list (grid of board cards) | Yes |
| `/boards/[boardId]` | Board detail (lists + cards + drag-and-drop) | Yes |

### Layout

```
+layout.svelte
├── Nav
│   ├── Logo ("KanBang")
│   ├── (spacer)
│   └── UserMenu (username + logout button)
└── {children}
```

The nav bar is shown on all authenticated pages. Login and register pages have no nav.

---

## Component Tree

### Board List Page (`/boards`)

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

### Board Detail Page (`/boards/[boardId]`)

```
BoardDetailPage
├── BoardHeader
│   ├── Board name (editable inline, double-click to edit)
│   └── Archive icon (wastebasket, visible only during name edit)
├── DragDropBoard
│   ├── ListColumn (repeated, horizontally draggable)
│   │   ├── ListHeader
│   │   │   ├── List name (editable inline)
│   │   │   └── Dropdown menu
│   │   │       └── Archive list
│   │   ├── CardItem (repeated, vertically draggable)
│   │   │   ├── Card title
│   │   │   └── Edit/Archive actions (on hover/focus)
│   │   └── CreateCardForm (inline at bottom)
│   │       └── Title input + Add button
│   └── CreateListForm (at end of horizontal row)
│       └── Name input + Add button
└── ArchivedItemsPanel (collapsible, collapsed by default)
    ├── Archived Lists section
    │   └── ArchivedListEntry (repeated)
    │       ├── List name + card count
    │       └── Unarchive button
    └── Archived Cards section
        └── ArchivedCardEntry (repeated)
            ├── Card title + list name
            └── Unarchive button
```

---

## Component Specifications

### Nav

- **Props**: `user: AuthUser | null`
- **Behavior**: Shows logo on left. If user is authenticated, shows username and logout button on right. Logout calls `POST /api/v1/auth/logout` and redirects to `/login`.

### BoardCard

- **Props**: `board: Board`
- **Behavior**: Clickable card that navigates to `/boards/{board.id}`. Shows board name.
- **Style**: Rounded rectangle with subtle shadow, hover effect.

### ArchivedBoardsSection

- **Props**: none
- **Behavior**: Toggled via the eye icon button in the page header. Closed-eye icon (default) means archived boards are hidden; open-eye icon means they are visible. On first toggle, fetches `GET /api/v1/boards?archived=true` and renders archived board cards below the active board grid. Subsequent toggles show/hide without re-fetching.
- **Style**: Muted/subtle appearance; visually separated from the active board grid.

### ArchivedBoardCard

- **Props**: `board: Board`
- **Behavior**: Displays board name (grayed out, not clickable). "Unarchive" button calls `PATCH /api/v1/boards/:boardId/unarchive`, then removes the card from the archived list and triggers a reload of the active boards grid.
- **Style**: Grayed-out variant of `BoardCard`.

### CreateBoardModal

- **Props**: none
- **Events**: `oncreate(board: Board)`, `onclose()`
- **Behavior**: Modal with name input. On submit, calls `POST /api/v1/boards`. Closes on success or cancel. Focuses input on open.

### DragDropBoard

- **Props**: `lists: ListWithCards[]`
- **Behavior**: Horizontal scrolling container. Uses `svelte-dnd-action` for nested drag-and-drop. See [06-drag-and-drop.md](./06-drag-and-drop.md) for details.

### ListColumn

- **Props**: `list: ListWithCards`
- **Events**: `oncardfinalize(event)` — bubbles card drop events up
- **Behavior**: Vertical column containing a header, sortable cards, and a "new card" form at the bottom. Inner `dndzone` for card reordering.
- **Style**: Fixed width (272px), light background, rounded corners, vertical scrollable.

### ListHeader

- **Props**: `name: string`, `listId: string`
- **Behavior**: Displays list name. Click to edit inline. Dropdown menu with "Archive list" option. No confirmation required (archiving is reversible). Calls `PATCH /api/v1/lists/:listId/archive` and removes the list from local state.

### CardItem

- **Props**: `card: Card`
- **Behavior**: Displays card title. Click to open edit view (inline or modal). Hover/focus reveals edit and archive icons. Archive icon calls `PATCH /api/v1/cards/:cardId/archive` and removes the card from local state.
- **Style**: White card with subtle border, small shadow on hover. Draggable.

### ArchivedItemsPanel

- **Props**: `boardId: string`
- **Behavior**: Collapsible section below the drag-and-drop board, collapsed by default. Header reads "Archived items". On expand, fetches `GET /api/v1/boards/:boardId/archived`. Renders two sub-sections:
  - **Archived lists**: each entry shows list name and card count, with an "Unarchive" button. Unarchive calls `PATCH /api/v1/lists/:listId/unarchive`, removes the entry from the panel, and triggers a board reload so the list reappears.
  - **Archived cards**: each entry shows card title and the name of the list it belongs to, with an "Unarchive" button. Unarchive calls `PATCH /api/v1/cards/:cardId/unarchive`, removes the entry from the panel, and triggers a board reload so the card reappears in its list.
- If there are no archived items, the panel shows a "Nothing archived yet" empty state.
- **Style**: Muted/grayed appearance to visually distinguish from the active board. Does not participate in drag-and-drop.

### CreateCardForm

- **Props**: `listId: string`
- **Events**: `oncreate(card: Card)`
- **Behavior**: Initially shows "+ Add a card" button. On click, expands to a textarea + "Add Card" button + close icon. Submit calls `POST /api/v1/lists/:listId/cards`.

### CreateListForm

- **Props**: `boardId: string`
- **Events**: `oncreate(list: List)`
- **Behavior**: Initially shows "+ Add another list" button. On click, expands to name input + "Add List" button. Submit calls `POST /api/v1/boards/:boardId/lists`.

### UI Primitives (`lib/components/ui/`)

- **Button**: Standard button with variant (primary, secondary, danger, ghost), size (sm, md), and loading state.
- **Input**: Text input with label, error message, and focus management.
- **Modal**: Overlay + centered dialog. Trap focus. Close on Escape or backdrop click.
- **DropdownMenu**: Trigger button + popover menu with action items.

---

## State Management

### Server-Side Data Loading

All page data is loaded via SvelteKit `+page.server.ts` `load()` functions:

```typescript
// /boards/+page.server.ts
export const load: PageServerLoad = async ({ fetch }) => {
  const res = await fetch('/api/v1/boards');
  const { boards } = await res.json();
  return { boards };
};
```

### Client-Side State

For the board detail page, data from `load()` is held in reactive `$state` (Svelte 5 runes). Drag-and-drop operations optimistically mutate this state, then sync with the API.

```svelte
<script>
  let { data } = $props();
  let lists = $state(data.board.lists);
</script>
```

### Auth State

The root layout's `+layout.server.ts` fetches `/api/v1/auth/me` and passes the user (or null) through page data. All child pages can access `data.user`.

---

## API Client (`lib/api.ts`)

A typed fetch wrapper that:
1. Prepends the API base URL
2. Includes credentials (cookies)
3. Adds `Content-Type: application/json` for POST/PATCH
4. Throws on non-2xx responses with parsed error body
5. Returns typed responses

```typescript
async function api<T>(path: string, options?: RequestInit): Promise<T>
```

---

## Responsive Design

| Breakpoint | Behavior |
|------------|----------|
| < 640px | Board list: single column. Board detail: horizontal scroll with narrower columns. |
| 640-1024px | Board list: 2 columns. Board detail: horizontal scroll. |
| > 1024px | Board list: 3-4 columns. Board detail: full width horizontal scroll. |

---

## Accessibility

- All interactive elements are keyboard accessible
- Modal traps focus and closes on Escape
- Drag-and-drop has keyboard support via `svelte-dnd-action`'s built-in keyboard mode
- Form inputs have associated labels
- Error messages are associated with inputs via `aria-describedby`
- Color contrast meets WCAG AA (4.5:1 for body text)
