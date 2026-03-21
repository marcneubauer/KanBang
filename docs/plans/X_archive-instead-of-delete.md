# Plan: Archive Instead of Delete

**Status:** Complete
**Scope:** Boards, lists, and cards — replace all permanent deletion with soft-archive/unarchive

---

## Goal

Remove all permanent delete operations from KanBang. Instead, users archive items (boards, lists, cards). Archived items are hidden from the normal view but remain in the database and can be viewed and unarchived at any time.

---

## Design Decisions

### Archive model: independent per item

Each table (boards, lists, cards) gets its own `archived_at` column. Archiving one item does **not** cascade to children. Display logic hides children transitively:

- An archived board is hidden from the boards list. Its lists and cards are untouched.
- An archived list is hidden from its board. Its cards are untouched.
- An archived card is hidden from its list.

This means unarchiving is always a single-item operation — just clear that item's `archived_at`. No cascade logic in the API or database.

**Why not cascade?** Cascading archive creates ambiguity on unarchive: should unarchiving a list restore previously-archived cards? The independent model avoids this entirely.

### No deletion at all

There is no API endpoint or UI affordance for permanent deletion of boards, lists, or cards. Passkeys remain deletable (they are credentials, not content).

### Archive view locations

- **Boards page (`/boards`):** a small "Show archived boards" toggle link below the board grid. Reveals a grayed-out row of archived boards, each with an "Unarchive" button.
- **Board detail page (`/boards/[boardId]`):** a collapsible "Archived items" panel below the drag-and-drop board. Shows two sections: archived lists (each showing its own cards) and archived cards from active lists. Each item has an "Unarchive" button.

---

## Database Changes (`02-database-schema.md`)

### New column on each table

Add to `boards`, `lists`, and `cards`:

```sql
archived_at INTEGER  -- NULL = active, Unix timestamp = archived
```

No index needed — archive queries are rare enough that a full scan is acceptable.

### Query behavior

- All existing queries add `WHERE archived_at IS NULL` to exclude archived items.
- New archived-view queries use `WHERE archived_at IS NOT NULL`.

### No schema changes to `users`, `credentials`, or `sessions`

---

## API Changes (`03-rest-api.md`)

### Removed endpoints

| Old endpoint | Replacement |
|---|---|
| `DELETE /api/v1/boards/:boardId` | `PATCH /api/v1/boards/:boardId/archive` |
| `DELETE /api/v1/lists/:listId` | `PATCH /api/v1/lists/:listId/archive` |
| `DELETE /api/v1/cards/:cardId` | `PATCH /api/v1/cards/:cardId/archive` |

### New endpoints

#### Board archive/unarchive

```
PATCH /api/v1/boards/:boardId/archive
PATCH /api/v1/boards/:boardId/unarchive
```

Both return `{ "ok": true }`. Authorization: board must belong to the authenticated user.

#### List archive/unarchive

```
PATCH /api/v1/lists/:listId/archive
PATCH /api/v1/lists/:listId/unarchive
```

Both return `{ "ok": true }`.

#### Card archive/unarchive

```
PATCH /api/v1/cards/:cardId/archive
PATCH /api/v1/cards/:cardId/unarchive
```

Both return `{ "ok": true }`.

#### Archived boards list

Add optional query parameter to existing endpoint:

```
GET /api/v1/boards?archived=true
```

Returns only archived boards. Default (`archived` omitted or `false`) returns only active boards. Same response shape as current `GET /api/v1/boards`.

Response objects include `archivedAt` (ISO 8601 string or `null`).

#### Archived items within a board

```
GET /api/v1/boards/:boardId/archived
```

Returns archived lists and archived cards in active lists for the given board.

**Response (200):**
```json
{
  "archivedLists": [
    {
      "id": "list1",
      "name": "Old Column",
      "position": "a0",
      "archivedAt": "2025-03-01T12:00:00.000Z",
      "cards": [
        {
          "id": "card1",
          "title": "Some task",
          "completed": false,
          "archivedAt": null
        }
      ]
    }
  ],
  "archivedCards": [
    {
      "id": "card2",
      "title": "Archived task",
      "listId": "list2",
      "listName": "In Progress",
      "position": "a0",
      "completed": false,
      "archivedAt": "2025-03-10T09:00:00.000Z"
    }
  ]
}
```

- `archivedLists`: lists belonging to this board where `archived_at IS NOT NULL`, each with their cards (regardless of those cards' `archived_at`)
- `archivedCards`: cards where `archived_at IS NOT NULL` belonging to lists that are NOT archived

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

### Response object changes

All board, list, and card response objects gain an `archivedAt` field:

```json
{ "archivedAt": null }          // active
{ "archivedAt": "2025-03-01T12:00:00.000Z" }   // archived
```

This applies to: `GET /api/v1/boards`, `GET /api/v1/boards/:boardId`, `GET /api/v1/lists/:listId`, `GET /api/v1/cards/:cardId`, and all create/update responses.

---

## Frontend Changes (`05-frontend-components.md`)

### Modified components

#### `BoardHeader`
- Remove "Delete board" button
- Add `...` board actions menu (or repurpose existing)
- Menu contains: "Archive board"
- On confirm, calls `PATCH /api/v1/boards/:boardId/archive`, then navigates to `/boards`

#### `ListHeader`
- Dropdown menu: replace "Delete list" with "Archive list"
- No confirmation dialog required (archiving is reversible)
- On archive, calls `PATCH /api/v1/lists/:listId/archive`, removes list from local state

#### `CardItem`
- On hover/focus: replace delete icon with an archive icon (box with down arrow, or similar)
- On click, calls `PATCH /api/v1/cards/:cardId/archive`, removes card from local state

### New components

#### `ArchivedBoardsSection`
- **Location:** Below `BoardGrid` on `/boards`
- **Trigger:** "Show archived boards" link/button (small, muted style)
- **Behavior:** Toggle visibility. When shown, fetches `GET /api/v1/boards?archived=true` and renders a row of grayed-out board cards, each with an "Unarchive" button.
- **Unarchive:** Calls `PATCH /api/v1/boards/:boardId/unarchive`, removes from archived list, triggers boards refetch.

#### `ArchivedItemsPanel`
- **Location:** Below `DragDropBoard` on `/boards/[boardId]`
- **Trigger:** "Archived items" collapsible section header (collapsed by default)
- **Behavior:** On expand, fetches `GET /api/v1/boards/:boardId/archived`. Renders two sub-sections:
  - **Archived lists:** each displayed as a compact column-like card showing list name, card count, and an "Unarchive" button
  - **Archived cards:** each displayed as a compact card row showing card title, which list it belongs to, and an "Unarchive" button
- **Unarchive list:** Calls `PATCH /api/v1/lists/:listId/unarchive`, removes from panel, triggers board refetch so the list reappears.
- **Unarchive card:** Calls `PATCH /api/v1/cards/:cardId/unarchive`, removes from panel, triggers board refetch so the card reappears in its list.
- **Style:** Muted/grayed appearance to distinguish from active content. Does not interfere with the drag-and-drop board above.

### Updated component tree (board detail page)

```
BoardDetailPage
├── BoardHeader
│   ├── Board name (editable inline)
│   └── Board actions menu (... button)
│       └── Archive board
└── DragDropBoard
    ├── ListColumn (repeated)
    │   ├── ListHeader
    │   │   ├── List name (editable inline)
    │   │   └── Dropdown menu
    │   │       └── Archive list
    │   ├── CardItem (repeated)
    │   │   ├── Card title
    │   │   └── Edit/Archive actions (on hover/focus)
    │   └── CreateCardForm
    └── CreateListForm
ArchivedItemsPanel (collapsible, below board)
    ├── Archived Lists section
    │   └── ArchivedListEntry (name, card count, Unarchive button)
    └── Archived Cards section
        └── ArchivedCardEntry (title, list name, Unarchive button)
```

### Updated component tree (boards page)

```
BoardListPage
├── PageHeader
├── BoardGrid
│   └── BoardCard (repeated)
├── CreateBoardModal
└── ArchivedBoardsSection (collapsed by default)
    └── ArchivedBoardCard (grayed, Unarchive button)
```

---

## Testing Changes (`07-testing-strategy.md`)

### Unit test changes

**`board.service.test.ts`** — replace delete tests:
- Remove: `deleteBoard()` cascades to lists and cards
- Add: `archiveBoard()` sets `archived_at`, does not touch lists or cards
- Add: `unarchiveBoard()` clears `archived_at`
- Add: `getBoards()` excludes archived boards by default
- Add: `getArchivedBoards()` returns only archived boards

**`list.service.test.ts`** — replace delete tests:
- Remove: `deleteList()` cascades to cards
- Add: `archiveList()` sets `archived_at` on list only
- Add: `unarchiveList()` clears `archived_at`
- Add: list queries exclude archived lists

**`card.service.test.ts`** — replace delete tests:
- Remove: `deleteCard()` removes only the target card
- Add: `archiveCard()` sets `archived_at`
- Add: `unarchiveCard()` clears `archived_at`
- Add: card queries exclude archived cards

### Integration test changes

**`boards.test.ts`:**
- Remove: `Delete board → cascades`
- Add: `Archive board → 200`
- Add: `Unarchive board → 200`
- Add: `Get boards → archived boards excluded`
- Add: `Get boards?archived=true → returns only archived boards`
- Add: `Get /boards/:boardId/archived → returns archived lists and cards`

**`lists.test.ts`:**
- Remove: `Delete list → cards cascade deleted`
- Add: `Archive list → 200, list excluded from board detail`
- Add: `Unarchive list → 200, list reappears in board detail`

**`cards.test.ts`:**
- Remove: `Delete card → 200`
- Add: `Archive card → 200, card excluded from list`
- Add: `Unarchive card → 200, card reappears in list`

### E2E test changes

**`boards.spec.ts`:**
- Remove: `Delete a board`
- Add: `Archive a board → board disappears from list`
- Add: `Show archived boards → archived board appears`
- Add: `Unarchive a board → board reappears in list`

**`lists.spec.ts`:**
- Remove: `Delete a list (confirm dialog)`
- Add: `Archive a list → list disappears from board`
- Add: `Open archived items panel → archived list visible`
- Add: `Unarchive a list → list reappears on board`

**`cards.spec.ts`:**
- Remove: `Delete a card`
- Add: `Archive a card → card disappears from list`
- Add: `Open archived items panel → archived card visible`
- Add: `Unarchive a card → card reappears in its list`

---

## Implementation Order

1. ✅ **DB migration** — add `archived_at` to boards, lists, cards; update Drizzle schema
2. ✅ **Service layer** — add archive/unarchive methods; update all queries to filter `archived_at IS NULL`; add `getArchivedItems` for board view
3. ✅ **API routes** — add archive/unarchive endpoints; add `GET /boards?archived` param; add `GET /boards/:boardId/archived`; remove DELETE endpoints
4. ✅ **Shared types/schemas** — add `archivedAt` to Zod schemas and TypeScript types
5. ✅ **Frontend** — update `BoardHeader`, `ListHeader`, `CardItem` to use archive actions; build `ArchivedBoardsSection` and `ArchivedItemsPanel`
6. ✅ **Tests** — update unit, integration, and E2E tests (backend; E2E deferred until frontend done)
