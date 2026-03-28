# Plan: List Collapse

## Context

Allow users to collapse a list into a narrow vertical strip showing only its title and card count. This is useful for boards with many lists — users can minimize lists they're not actively working on to reduce visual noise and reclaim horizontal space.

Trello's collapse behavior is the reference: a collapsed list becomes a thin vertical bar with the title rotated 90°. Clicking the bar expands it back.

---

## Design Decisions

### Frontend-only, localStorage persistence

Collapse state is a UI preference, not board data. Storing it in `localStorage` keyed by board ID avoids a database migration and API changes entirely. The trade-off is that collapse state doesn't sync across devices — acceptable for a personal self-hosted app.

Storage key: `kanbang:collapsed-lists:<boardId>` → JSON array of list IDs.

### No drag-and-drop while collapsed

A collapsed list cannot be a drop target for cards (there's nowhere to show them). It can still be dragged to reorder among other lists. Cards dragged over a collapsed list will skip it.

### Collapse button in list header, expand on click

- A chevron/collapse icon in the list header (alongside the archive icon) triggers collapse.
- Clicking anywhere on the collapsed strip expands the list.
- The collapsed strip shows: rotated list name + card count badge.

---

## Frontend Changes

### Collapse state management

**File:** `packages/web/src/routes/boards/[boardId]/+page.svelte`

New state and helpers:

```typescript
let collapsedListIds = $state<Set<string>>(loadCollapsedLists(data.board.id));

function loadCollapsedLists(boardId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`kanbang:collapsed-lists:${boardId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveCollapsedLists(boardId: string, ids: Set<string>) {
  localStorage.setItem(`kanbang:collapsed-lists:${boardId}`, JSON.stringify([...ids]));
}

function toggleCollapse(listId: string) {
  if (collapsedListIds.has(listId)) {
    collapsedListIds.delete(listId);
  } else {
    collapsedListIds.add(listId);
  }
  collapsedListIds = new Set(collapsedListIds); // trigger reactivity
  saveCollapsedLists(data.board.id, collapsedListIds);
}
```

### List rendering — collapsed vs expanded

In the `{#each lists as list}` block, branch on collapse state:

```svelte
{#each lists as list (list.id)}
  {#if collapsedListIds.has(list.id)}
    <div
      class="list-collapsed"
      onclick={() => toggleCollapse(list.id)}
      role="button"
      tabindex="0"
      onkeydown={(e) => { if (e.key === 'Enter') toggleCollapse(list.id); }}
      aria-label="Expand list {list.name}"
    >
      <span class="list-collapsed-name">{list.name}</span>
      {#if list.cards.length > 0}
        <span class="list-collapsed-count">{list.cards.length}</span>
      {/if}
    </div>
  {:else}
    <div class="list-column">
      <!-- existing list content -->
    </div>
  {/if}
{/each}
```

### Collapse button in list header

Add a collapse chevron button to `.list-header`, next to the archive button:

```svelte
<button
  class="list-collapse-btn"
  onclick={(e) => { e.stopPropagation(); toggleCollapse(list.id); }}
  aria-label="Collapse list"
>
  <svg viewBox="0 0 14 14" width="12" height="12"
    fill="none" stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 3L5 7l4 4"/>
  </svg>
</button>
```

Style it identically to `.list-archive` (hidden until hover).

### Collapsed list styles

```css
.list-collapsed {
  flex-shrink: 0;
  width: 40px;
  max-height: 100%;
  background: #ebecf0;
  border-radius: var(--radius);
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: background 150ms;
}

.list-collapsed:hover {
  background: #dfe1e6;
}

.list-collapsed-name {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-height: calc(100% - 30px);
}

.list-collapsed-count {
  margin-top: 8px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.1);
  color: var(--color-text-subtle);
  border-radius: 10px;
  padding: 2px 6px;
  min-width: 20px;
  text-align: center;
}
```

### Drag-and-drop considerations

The collapsed list div must still participate in the `dndzone` for list reordering. Since both `.list-column` and `.list-collapsed` are direct children of `.board-columns` (the dnd container), svelte-dnd-action will handle them identically — drag handles work on both.

Cards cannot be dropped onto a collapsed list. The `dndzone` for cards lives inside the expanded `.list-column` block and simply won't exist when the list is collapsed, which is the correct behavior — svelte-dnd-action ignores elements without a card-type dnd zone.

### Keyboard accessibility

- Collapsed strip is a focusable button (`tabindex="0"`, `role="button"`)
- Enter/Space expands the list
- Collapse button in the header is a standard `<button>`

---

## Edge Cases

### Archived/unarchived lists

When a list is unarchived, it returns expanded (not in `collapsedListIds`). No special handling needed.

### New lists

New lists are added expanded by default. No special handling needed.

### Empty localStorage / first visit

`loadCollapsedLists` returns an empty Set — all lists expanded. Graceful degradation.

### List deleted from collapsed state

If a collapsed list's ID lingers in localStorage after deletion, it's harmless — the ID won't match any list in the `lists` array. Optionally, clean up stale IDs on board load by intersecting stored IDs with actual list IDs.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/web/src/routes/boards/[boardId]/+page.svelte` | Collapse state, toggle logic, conditional rendering, collapse button, new CSS |

No backend changes. No shared package changes. No new files needed — everything fits in the existing board page.

---

## E2E Tests

**File:** `e2e/list-collapse.spec.ts` (new)

- Click collapse button → list collapses to vertical strip with name
- Collapsed strip shows card count
- Click collapsed strip → list expands back
- Collapse state persists after page reload (localStorage)
- Collapsed list can still be reordered via drag
- Cards cannot be dropped onto collapsed list
- Keyboard: Tab to collapse button, Enter collapses; Tab to strip, Enter expands

---

## Implementation Order

1. Collapse state management (localStorage load/save, toggle function)
2. Collapse button in list header
3. Conditional rendering (collapsed strip vs full list)
4. CSS for collapsed strip
5. Verify drag-and-drop still works for list reordering
6. E2E tests
