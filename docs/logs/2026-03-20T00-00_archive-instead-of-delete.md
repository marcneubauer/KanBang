# Session Log — 2026-03-20 00:00

## Goal

Replace all permanent delete operations on boards, lists, and cards with a soft-archive/unarchive system. Update the relevant specification documents and write a detailed implementation plan.

---

## Prompts and Actions

### "come up with a plan for making it so that we archive cards and boards instead of deleting them"

Explored all eight spec files (`00`–`07`) to understand the current delete model:
- Three `DELETE` endpoints (boards, lists, cards)
- `ON DELETE CASCADE` at the DB level
- Delete buttons/icons in `BoardHeader`, `ListHeader`, and `CardItem`
- Delete-oriented test cases across unit, integration, and E2E suites

Presented a design plan covering: archive model, DB changes, API changes, frontend changes, and testing changes. Key design decision: **independent archive state per item** (no cascade). Archiving a board does not archive its lists/cards; display logic hides children transitively. This makes unarchiving a single-item operation with no ambiguity.

### "write this plan out in enough detail to a plan file, and update the appropriate specs to match"

**Created:**
- `docs/plans/O_archive-instead-of-delete.md` — full implementation plan

**Updated:**

| File | Summary of changes |
|---|---|
| `docs/specs/00-project-overview.md` | Scope bullets: "delete" → "archive/unarchive" |
| `docs/specs/02-database-schema.md` | Added `archived_at INTEGER NULLABLE` to boards, lists, and cards tables; added "Archiving Strategy" section explaining the independent-per-item model and query behavior |
| `docs/specs/03-rest-api.md` | Removed `DELETE /boards/:boardId`, `DELETE /lists/:listId`, `DELETE /cards/:cardId`; added 6 archive/unarchive PATCH endpoints; added `GET /boards?archived=true` query param; added `GET /boards/:boardId/archived` endpoint with response shape; added `archivedAt` field to all board/list/card response objects |
| `docs/specs/05-frontend-components.md` | Updated component trees for `/boards` and `/boards/[boardId]`; replaced delete UI with archive actions in `ListHeader` and `CardItem`; added `ArchivedBoardsSection`, `ArchivedBoardCard`, and `ArchivedItemsPanel` component specs |
| `docs/specs/07-testing-strategy.md` | Replaced all delete test cases with archive/unarchive equivalents across unit, integration, and E2E suites; added cascade-independence tests and archived-view endpoint tests |

### "write out the session log commit and push the plans and updates"

Wrote this session log, committed, and pushed.

---

## Key Decisions

**Independent archive state (no cascade):** Each table has its own `archived_at`. Archiving a board does not touch its lists or cards. This avoids the unarchive ambiguity ("should unarchiving a list restore previously-archived cards?") and keeps service logic simple — archive/unarchive is always a single `UPDATE` on one row.

**No deletion at all:** Passkeys remain deletable (credentials, not content). Everything else is archive-only.

**Archive view locations:** Boards page gets a "Show archived boards" toggle below the grid. Board detail page gets a collapsible "Archived items" panel below the drag-and-drop board — unobtrusive but discoverable.

**`GET /boards/:boardId/archived` shape:** Returns two separate arrays — `archivedLists` (with their cards regardless of card archive state) and `archivedCards` (only cards from active lists). This avoids double-counting and gives the UI exactly what it needs to render each sub-section.
