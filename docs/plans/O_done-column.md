# Plan: Done Column

## Context

Add a "Done" column feature: a special list per board that completed cards auto-move into. Cards in the Done column are automatically archived 3 days after being marked complete.

**Prerequisite:** Due dates plan should be implemented first — the auto-archive scheduling mechanism introduced there (Fastify plugin with `setInterval`) is reused here for the 3-day auto-archive.

---

## Design Decisions

### One Done list per board, opt-in

Each board can have at most one Done list, indicated by a `isDone` boolean column on the lists table. The user designates an existing list as the Done list (or creates one) via a list header menu option. This avoids auto-creating lists the user didn't ask for.

### Auto-move on completion toggle

When a card's `completed` status is set to `true` via the API, the backend automatically moves it to the Done list (if one exists for that board). When toggled back to `false`, the card stays where it is — the user moves it manually.

This logic lives in the card service `update()` method, not in the frontend. This ensures consistency regardless of client.

### Auto-archive after 3 days

Cards in the Done list that have been completed for 3+ days are automatically archived. The "completed at" time is tracked via a new `completedAt` timestamp on cards.

A background job (Fastify plugin with `setInterval`, same pattern as due-date cleanup) runs every hour and archives qualifying cards.

### Done list visual treatment

The Done list looks like a normal list but with:
- A checkmark icon next to the list name
- Cannot be reordered to middle of board (always last, enforced in UI only — not a hard constraint)
- Muted card styling (reduced opacity) since cards here are "done"

### Done list protection

- Cannot archive the Done list while it's designated as Done (must un-designate first)
- Deleting/archiving the board still cascades normally

---

## Database Changes

### Lists table: add `isDone` column

**File:** `packages/api/src/db/schema/lists.ts`

```sql
is_done INTEGER NOT NULL DEFAULT 0  -- boolean
```

### Cards table: add `completedAt` column

**File:** `packages/api/src/db/schema/cards.ts`

```sql
completed_at INTEGER  -- timestamp, NULL = not completed or completed before this feature
```

Set when `completed` transitions from `false` to `true`. Cleared when toggled back to `false`.

### Migration

Run `pnpm db:generate`. Migration will add both columns with defaults (no data backfill needed — existing completed cards get `completedAt = NULL` which means they won't be auto-archived, which is safe).

---

## Shared Types

### `packages/shared/src/types/list.ts`

Add `isDone: boolean` to the `List` interface.

### `packages/shared/src/types/card.ts`

Add `completedAt: Date | null` to the `Card` interface.

### `packages/shared/src/validation/list.ts`

Add schema:

```typescript
export const setDoneListSchema = z.object({
  isDone: z.boolean(),
});
```

---

## API Changes

### New endpoint: designate Done list

```
PATCH /api/v1/lists/:listId/done
Body: { isDone: boolean }
```

When `isDone: true`:
- Clear `isDone` on any other list in the same board (only one Done list per board)
- Set `isDone = true` on the target list

When `isDone: false`:
- Clear `isDone` on the target list

Returns `{ list }`.

### Modified: card update auto-move

**File:** `packages/api/src/services/card.service.ts`

In the `update()` method, when `completed` changes to `true`:

1. Look up the card's board (card → list → board)
2. Find the Done list for that board (`isDone = true`)
3. If a Done list exists and the card isn't already in it:
   - Compute a new fractional position at the end of the Done list
   - Update the card's `listId` and `position` (same as a move)
4. Set `completedAt = new Date()`

When `completed` changes to `false`:
- Clear `completedAt = null`
- Do NOT auto-move back

The response includes the updated `listId` so the frontend knows the card moved.

### Modified: board detail response

Include `isDone` in list objects. Include `completedAt` in card objects.

---

## Background Job: Auto-Archive

### `packages/api/src/plugins/done-cleanup.ts` (new)

Fastify plugin that starts an hourly interval after the app is ready:

```typescript
export default fp(async (fastify) => {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  const ARCHIVE_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

  const timer = setInterval(async () => {
    const cutoff = new Date(Date.now() - ARCHIVE_AFTER_MS);
    await fastify.db
      .update(cards)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(cards.completed, true),
          isNotNull(cards.completedAt),
          lte(cards.completedAt, cutoff),
          isNull(cards.archivedAt),
          // Only cards in Done lists
          inArray(
            cards.listId,
            fastify.db.select({ id: lists.id }).from(lists).where(eq(lists.isDone, true))
          )
        )
      );
  }, INTERVAL_MS);

  fastify.addHook('onClose', () => clearInterval(timer));
});
```

Register in `app.ts` after the DB plugin.

---

## Frontend Changes

### List header menu: "Set as Done list" / "Remove Done status"

**File:** `packages/web/src/routes/boards/[boardId]/+page.svelte`

Add a toggle option in the list dropdown menu. Calls `PATCH /api/v1/lists/:listId/done` with `{ isDone: true/false }`.

### Done list visual indicators

- Checkmark icon (✓) next to the Done list name
- Cards in the Done list rendered with reduced opacity (`opacity: 0.6`)
- Optional: subtle green-tinted header background

### Card completion → auto-move handling

When `toggleCardCompleted()` is called and the API response shows the card's `listId` changed:
- Remove the card from its current list in local state
- Add it to the Done list in local state (at the end)

```typescript
async function toggleCardCompleted(cardId: string, listId: string, completed: boolean) {
  const { card } = await api(`/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  });

  if (card.listId !== listId) {
    // Card was auto-moved to Done list
    // Remove from old list
    const oldListIdx = lists.findIndex((l) => l.id === listId);
    lists[oldListIdx].cards = lists[oldListIdx].cards.filter((c) => c.id !== cardId);
    // Add to new list
    const newListIdx = lists.findIndex((l) => l.id === card.listId);
    if (newListIdx !== -1) {
      lists[newListIdx].cards.push({ ...card });
    }
  } else {
    // Just update completed status in place
    const listIndex = lists.findIndex((l) => l.id === listId);
    const c = lists[listIndex].cards.find((c) => c.id === cardId);
    if (c) { c.completed = completed; c.completedAt = card.completedAt; }
  }
}
```

### ListItem interface update

Add `isDone: boolean` to the `ListItem` interface in the board page.

### CardItem interface update

Add `completedAt: string | null` to the `CardItem` interface.

---

## Service Layer Changes

### `packages/api/src/services/list.service.ts`

Add method:

```typescript
async setDone(listId: string, isDone: boolean): Promise<List> {
  if (isDone) {
    // Get the board for this list
    const [list] = await this.db.select().from(lists).where(eq(lists.id, listId));
    // Clear isDone on all other lists in the same board
    await this.db
      .update(lists)
      .set({ isDone: false, updatedAt: new Date() })
      .where(and(eq(lists.boardId, list.boardId), ne(lists.id, listId)));
  }
  const [updated] = await this.db
    .update(lists)
    .set({ isDone, updatedAt: new Date() })
    .where(eq(lists.id, listId))
    .returning();
  return updated;
}

async getDoneList(boardId: string): Promise<List | null> {
  const [list] = await this.db
    .select()
    .from(lists)
    .where(and(eq(lists.boardId, boardId), eq(lists.isDone, true), isNull(lists.archivedAt)))
    .limit(1);
  return list ?? null;
}
```

### `packages/api/src/services/card.service.ts`

Modify `update()` to accept `listService` dependency (or inject at construction). When `completed` changes:

```typescript
if (input.completed !== undefined) {
  updates.completed = input.completed;
  if (input.completed) {
    updates.completedAt = new Date();
    // Auto-move to Done list
    const currentListId = await this.getListId(cardId);
    const boardId = await this.getBoardId(currentListId);
    const doneList = await this.listService.getDoneList(boardId);
    if (doneList && currentListId !== doneList.id) {
      const lastPosition = await this.getLastPosition(doneList.id);
      updates.listId = doneList.id;
      updates.position = generateKeyBetween(lastPosition, null);
    }
  } else {
    updates.completedAt = null;
  }
}
```

---

## Integration Tests

**File:** `packages/api/tests/integration/done-column.test.ts` (new)

- Designate a list as Done → `isDone: true`
- Only one Done list per board (designating another clears the first)
- Remove Done status → `isDone: false`
- Mark card complete → auto-moves to Done list
- Mark card incomplete → stays in Done list, `completedAt` cleared
- Mark card complete with no Done list → stays in place, `completedAt` set
- Board detail response includes `isDone` on lists and `completedAt` on cards
- Auto-archive: cards completed 3+ days ago in Done list get archived (test by manipulating `completedAt` directly, then calling the cleanup function)
- Cannot archive Done list while `isDone = true` (or: un-designate first)

---

## E2E Tests

**File:** `e2e/done-column.spec.ts` (new)

- Set a list as Done list via menu
- Complete a card → card moves to Done list
- Uncomplete a card in Done list → card stays, checkbox unchecked
- Remove Done status from list → no more auto-moves
- Verify Done list visual indicators (checkmark icon)

---

## Implementation Order

1. DB migration — add `isDone` to lists, `completedAt` to cards
2. Shared types + validation
3. List service — `setDone()`, `getDoneList()`
4. Card service — modify `update()` for auto-move logic
5. API routes — new `PATCH /lists/:listId/done` endpoint
6. Background job plugin — auto-archive cleanup
7. Integration tests
8. Frontend — list menu, auto-move handling, visual indicators
9. E2E tests
