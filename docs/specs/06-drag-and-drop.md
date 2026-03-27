# KanBang — Drag-and-Drop Specification

## Library

**svelte-dnd-action** v0.9.x — a Svelte action-based drag-and-drop library that supports nested sortable zones, cross-container moves, and keyboard accessibility.

## Interaction Model

### List Reordering

- Lists are arranged **horizontally** in a scrollable container
- Users drag a list by its header to reorder among other lists
- Drop zones: between any two lists, or at the start/end of the board

### Card Reordering (within a list)

- Cards are arranged **vertically** within each list column
- Users drag a card by clicking and dragging its body
- Drop zones: between any two cards in the same list, or at the top/bottom

### Card Moving (across lists)

- Users can drag a card from one list and drop it into another list
- The card is removed from the source list and inserted at the drop position in the target list

---

## Implementation

### Nested dndzone Configuration

```svelte
<!-- DragDropBoard.svelte -->
<div
  use:dndzone={{
    items: lists,
    type: 'list',
    flipDurationMs: 200,
    dropTargetStyle: {},
  }}
  on:consider={handleListConsider}
  on:finalize={handleListFinalize}
>
  {#each lists as list (list.id)}
    <div class="list-column">
      <ListColumn {list} />

      <!-- Inner zone for cards -->
      <div
        use:dndzone={{
          items: list.cards,
          type: 'card',
          flipDurationMs: 200,
          dropTargetStyle: {},
        }}
        on:consider={(e) => handleCardConsider(list.id, e)}
        on:finalize={(e) => handleCardFinalize(list.id, e)}
      >
        {#each list.cards as card (card.id)}
          <CardItem {card} />
        {/each}
      </div>
    </div>
  {/each}
</div>
```

### Type Separation

Setting `type: 'list'` on the outer zone and `type: 'card'` on inner zones ensures:
- Dragging a card does not trigger list reordering
- Dragging a list does not interact with card zones
- Cards can be dragged between different list zones (same type)

---

## Position Calculation

When an item is dropped, we need to compute a new fractional index `position` based on its new neighbors.

### Algorithm

```typescript
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index';

function computeNewPosition(items: { position: string }[], droppedIndex: number): string {
  const before = droppedIndex > 0 ? items[droppedIndex - 1].position : null;
  const after = droppedIndex < items.length - 1 ? items[droppedIndex + 1].position : null;
  return generateKeyBetween(before, after);
}
```

### Scenarios

| Scenario | before | after | Result |
|----------|--------|-------|--------|
| Drop at start of list | `null` | first item's position | Key before first |
| Drop at end of list | last item's position | `null` | Key after last |
| Drop between two items | item above's position | item below's position | Key between both |
| Drop into empty list | `null` | `null` | Initial key |

---

## Event Handling

### `consider` Event

Fired during drag (hover). Updates the visual state (placeholder position).

```typescript
function handleListConsider(event: CustomEvent) {
  lists = event.detail.items;
}

function handleCardConsider(listId: string, event: CustomEvent) {
  const listIndex = lists.findIndex(l => l.id === listId);
  lists[listIndex].cards = event.detail.items;
}
```

### `finalize` Event

Fired on drop. This is where we persist the change.

```typescript
async function handleListFinalize(event: CustomEvent) {
  const newLists = event.detail.items;
  const movedList = findMovedItem(lists, newLists);

  // Optimistic update
  lists = newLists;

  // Calculate new position
  const droppedIndex = newLists.findIndex(l => l.id === movedList.id);
  const newPosition = computeNewPosition(newLists, droppedIndex);

  try {
    await api(`/api/v1/lists/${movedList.id}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ position: newPosition }),
    });
  } catch (error) {
    // Rollback
    lists = previousLists;
    showError('Failed to reorder list');
  }
}
```

### Cross-List Card Move

When a card is dropped into a different list:

1. The `finalize` event fires on the **target** list
2. We detect the card was not originally in this list (by checking `info.source`)
3. We call `PATCH /api/v1/cards/:cardId/move` with the new `listId` and `position`

```typescript
async function handleCardFinalize(listId: string, event: CustomEvent) {
  const { items, info } = event.detail;
  const targetListIndex = lists.findIndex(l => l.id === listId);

  // Optimistic update
  lists[targetListIndex].cards = items;

  if (info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
    const card = items.find(c => c.id === info.id);
    const droppedIndex = items.findIndex(c => c.id === info.id);
    const newPosition = computeNewPosition(items, droppedIndex);

    try {
      await api(`/api/v1/cards/${card.id}/move`, {
        method: 'PATCH',
        body: JSON.stringify({ listId, position: newPosition }),
      });
    } catch (error) {
      // Rollback: reload board data
      await invalidateBoard();
      showError('Failed to move card');
    }
  }
}
```

---

## Visual Feedback

### During Drag

- **Dragged item**: Slightly rotated (2-3deg), elevated shadow, reduced opacity (0.8)
- **Drop placeholder**: Dashed border or light background color indicating where the item will be placed
- **Drag handle**: Cursor changes to `grab` / `grabbing`

### CSS Transitions

`svelte-dnd-action` uses the FLIP animation technique. The `flipDurationMs: 200` option controls the animation duration for items shifting position.

```css
.list-column {
  transition: transform 200ms ease;
}

.card-item {
  transition: transform 200ms ease;
}

/* Active drag state */
:global(.dragged) {
  opacity: 0.8;
  transform: rotate(2deg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
```

---

## Edge Cases

1. **Empty list**: Cards can be dropped into an empty list. Position is `generateKeyBetween(null, null)`.
2. **Single card in list**: Reordering is a no-op. Moving to another list works normally.
3. **Rapid drags**: Debounce is not needed — each finalize generates a correct position regardless of previous state.
4. **API failure**: UI rolls back to pre-drag state. A toast notification informs the user.
5. **Position collision**: Extremely unlikely with fractional indexing, but if positions become identical (corrupted data), a full re-index can be triggered server-side.
6. **Auto-move vs. user drag**: When a card is marked complete and a Done list exists, the backend auto-moves the card. The frontend must handle the response showing a changed `listId` by removing the card from its source list and appending it to the Done list in local state. This is a programmatic move, not a drag event — no drag-and-drop events fire. Users can still manually drag cards out of the Done list.

---

## Keyboard Accessibility

`svelte-dnd-action` provides built-in keyboard support:
- **Tab** to focus a draggable item
- **Space/Enter** to pick up the focused item
- **Arrow keys** to move the item
- **Space/Enter** again to drop
- **Escape** to cancel

The library announces actions via an ARIA live region for screen readers.
