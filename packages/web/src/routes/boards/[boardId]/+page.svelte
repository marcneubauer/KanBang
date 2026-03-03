<script lang="ts">
  import { api } from '$lib/api';
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import { dndzone } from 'svelte-dnd-action';
  import { generateKeyBetween } from '@kanbang/shared';

  let { data } = $props();

  let lists = $state(data.board.lists.map((l: any) => ({
    ...l,
    cards: l.cards.map((c: any) => ({ ...c })),
  })));

  const flipDurationMs = 200;

  // --- Board actions ---
  let editingBoardName = $state(false);
  let boardName = $state(data.board.name);

  async function saveBoardName() {
    if (!boardName.trim()) return;
    await api(`/boards/${data.board.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: boardName.trim() }),
    });
    editingBoardName = false;
  }

  async function deleteBoard() {
    if (!confirm('Delete this board and all its lists and cards?')) return;
    await api(`/boards/${data.board.id}`, { method: 'DELETE' });
    goto('/boards');
  }

  // --- List actions ---
  let addingList = $state(false);
  let newListName = $state('');

  async function addList(e: Event) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const { list } = await api<{ list: any }>(`/boards/${data.board.id}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: newListName.trim() }),
    });
    lists = [...lists, { ...list, cards: [] }];
    newListName = '';
  }

  async function renameList(listId: string, name: string) {
    await api(`/lists/${listId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  async function deleteList(listId: string) {
    if (!confirm('Delete this list and all its cards?')) return;
    await api(`/lists/${listId}`, { method: 'DELETE' });
    lists = lists.filter((l: any) => l.id !== listId);
  }

  // --- Card actions ---
  async function addCard(listId: string, title: string) {
    const { card } = await api<{ card: any }>(`/lists/${listId}/cards`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    const listIndex = lists.findIndex((l: any) => l.id === listId);
    lists[listIndex].cards = [...lists[listIndex].cards, card];
  }

  async function updateCard(cardId: string, updates: { title?: string; description?: string | null }) {
    await api(`/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async function deleteCard(cardId: string, listId: string) {
    await api(`/cards/${cardId}`, { method: 'DELETE' });
    const listIndex = lists.findIndex((l: any) => l.id === listId);
    lists[listIndex].cards = lists[listIndex].cards.filter((c: any) => c.id !== cardId);
  }

  // --- Drag and drop ---
  function computePosition(items: { position: string }[], index: number): string {
    const before = index > 0 ? items[index - 1].position : null;
    const after = index < items.length - 1 ? items[index + 1].position : null;
    return generateKeyBetween(before, after);
  }

  function handleListConsider(e: CustomEvent) {
    lists = e.detail.items;
  }

  async function handleListFinalize(e: CustomEvent) {
    const newLists = e.detail.items;
    const info = e.detail.info;

    lists = newLists;

    const movedIndex = newLists.findIndex((l: any) => l.id === info.id);
    if (movedIndex === -1) return;

    const newPosition = computePosition(newLists, movedIndex);

    try {
      await api(`/lists/${info.id}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ position: newPosition }),
      });
      lists[movedIndex].position = newPosition;
    } catch {
      invalidateAll();
    }
  }

  function handleCardConsider(listId: string, e: CustomEvent) {
    const listIndex = lists.findIndex((l: any) => l.id === listId);
    lists[listIndex].cards = e.detail.items;
  }

  async function handleCardFinalize(listId: string, e: CustomEvent) {
    const { items, info } = e.detail;
    const listIndex = lists.findIndex((l: any) => l.id === listId);
    lists[listIndex].cards = items;

    const movedIndex = items.findIndex((c: any) => c.id === info.id);
    if (movedIndex === -1) return;

    const newPosition = computePosition(items, movedIndex);

    try {
      await api(`/cards/${info.id}/move`, {
        method: 'PATCH',
        body: JSON.stringify({ listId, position: newPosition }),
      });
      lists[listIndex].cards[movedIndex].position = newPosition;
      lists[listIndex].cards[movedIndex].listId = listId;
    } catch {
      invalidateAll();
    }
  }

  // --- Inline editing helpers ---
  let editingListId = $state<string | null>(null);
  let editingListName = $state('');
  let addingCardToList = $state<string | null>(null);
  let newCardTitle = $state('');
  let editingCardId = $state<string | null>(null);
  let editingCardTitle = $state('');

  function startEditList(listId: string, name: string) {
    editingListId = listId;
    editingListName = name;
  }

  async function saveListName() {
    if (editingListId && editingListName.trim()) {
      await renameList(editingListId, editingListName.trim());
      const idx = lists.findIndex((l: any) => l.id === editingListId);
      if (idx !== -1) lists[idx].name = editingListName.trim();
    }
    editingListId = null;
  }

  async function submitNewCard(e: Event, listId: string) {
    e.preventDefault();
    if (!newCardTitle.trim()) return;
    await addCard(listId, newCardTitle.trim());
    newCardTitle = '';
  }

  function startEditCard(cardId: string, title: string) {
    editingCardId = cardId;
    editingCardTitle = title;
  }

  async function saveCardTitle() {
    if (editingCardId && editingCardTitle.trim()) {
      await updateCard(editingCardId, { title: editingCardTitle.trim() });
      for (const list of lists) {
        const card = list.cards.find((c: any) => c.id === editingCardId);
        if (card) {
          card.title = editingCardTitle.trim();
          break;
        }
      }
    }
    editingCardId = null;
  }
</script>

<div class="board-page">
  <header class="board-header">
    {#if editingBoardName}
      <input
        class="board-name-input"
        bind:value={boardName}
        onblur={saveBoardName}
        onkeydown={(e) => e.key === 'Enter' && saveBoardName()}
        autofocus
      />
    {:else}
      <h1 class="board-name" ondblclick={() => { editingBoardName = true; }}>{boardName}</h1>
    {/if}
    <button class="btn-danger" onclick={deleteBoard}>Delete Board</button>
  </header>

  <div
    class="board-columns"
    use:dndzone={{ items: lists, type: 'list', flipDurationMs, dropTargetStyle: {} }}
    onconsider={handleListConsider}
    onfinalize={handleListFinalize}
  >
    {#each lists as list (list.id)}
      <div class="list-column">
        <div class="list-header">
          {#if editingListId === list.id}
            <input
              class="list-name-input"
              bind:value={editingListName}
              onblur={saveListName}
              onkeydown={(e) => e.key === 'Enter' && saveListName()}
              autofocus
            />
          {:else}
            <h2 class="list-name" ondblclick={() => startEditList(list.id, list.name)}>
              {list.name}
            </h2>
          {/if}
          <button class="list-delete" onclick={() => deleteList(list.id)} aria-label="Delete list">&times;</button>
        </div>

        <div
          class="card-list"
          use:dndzone={{ items: list.cards, type: 'card', flipDurationMs, dropTargetStyle: {} }}
          onconsider={(e) => handleCardConsider(list.id, e)}
          onfinalize={(e) => handleCardFinalize(list.id, e)}
        >
          {#each list.cards as card (card.id)}
            <div class="card-item">
              {#if editingCardId === card.id}
                <input
                  class="card-title-input"
                  bind:value={editingCardTitle}
                  onblur={saveCardTitle}
                  onkeydown={(e) => e.key === 'Enter' && saveCardTitle()}
                  autofocus
                />
              {:else}
                <span class="card-title" ondblclick={() => startEditCard(card.id, card.title)}>
                  {card.title}
                </span>
              {/if}
              <button
                class="card-delete"
                onclick={() => deleteCard(card.id, list.id)}
                aria-label="Delete card"
              >&times;</button>
            </div>
          {/each}
        </div>

        {#if addingCardToList === list.id}
          <form class="add-card-form" onsubmit={(e) => submitNewCard(e, list.id)}>
            <textarea
              bind:value={newCardTitle}
              placeholder="Enter a title for this card..."
              rows="2"
              autofocus
            ></textarea>
            <div class="add-card-actions">
              <button type="submit" class="btn-primary-sm">Add Card</button>
              <button type="button" class="btn-close" onclick={() => { addingCardToList = null; newCardTitle = ''; }}>&times;</button>
            </div>
          </form>
        {:else}
          <button class="add-card-btn" onclick={() => { addingCardToList = list.id; }}>
            + Add a card
          </button>
        {/if}
      </div>
    {/each}

    <!-- Add list form -->
    <div class="add-list">
      {#if addingList}
        <form onsubmit={addList}>
          <input
            type="text"
            bind:value={newListName}
            placeholder="Enter list name..."
            autofocus
          />
          <div class="add-list-actions">
            <button type="submit" class="btn-primary-sm">Add List</button>
            <button type="button" class="btn-close" onclick={() => { addingList = false; newListName = ''; }}>&times;</button>
          </div>
        </form>
      {:else}
        <button class="add-list-btn" onclick={() => { addingList = true; }}>
          + Add another list
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .board-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .board-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    flex-shrink: 0;
  }

  .board-name {
    font-size: 18px;
    cursor: pointer;
  }

  .board-name-input {
    font-size: 18px;
    font-weight: 700;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-sm);
    padding: 2px 8px;
  }

  .btn-danger {
    padding: 6px 12px;
    background: var(--color-danger);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
  }

  .board-columns {
    display: flex;
    gap: 12px;
    padding: 0 16px 16px;
    overflow-x: auto;
    flex: 1;
    align-items: flex-start;
  }

  .list-column {
    flex-shrink: 0;
    width: 272px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: #ebecf0;
    border-radius: var(--radius);
    padding: 8px;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 8px;
  }

  .list-name {
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    flex: 1;
  }

  .list-name-input {
    font-size: 14px;
    font-weight: 600;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    flex: 1;
    width: 100%;
  }

  .list-delete {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    opacity: 0;
    transition: opacity 150ms;
  }

  .list-header:hover .list-delete {
    opacity: 1;
  }

  .card-list {
    min-height: 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    flex: 1;
  }

  .card-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 8px 8px;
    background: white;
    border-radius: var(--radius-sm);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    cursor: grab;
  }

  .card-item:active {
    cursor: grabbing;
  }

  .card-title {
    font-size: 14px;
    flex: 1;
    cursor: pointer;
    word-break: break-word;
  }

  .card-title-input {
    font-size: 14px;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-sm);
    padding: 2px 4px;
    flex: 1;
    width: 100%;
  }

  .card-delete {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    font-size: 16px;
    cursor: pointer;
    padding: 0 2px;
    opacity: 0;
    transition: opacity 150ms;
    flex-shrink: 0;
  }

  .card-item:hover .card-delete {
    opacity: 1;
  }

  .add-card-btn {
    display: block;
    width: 100%;
    padding: 8px 4px;
    margin-top: 4px;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-subtle);
    cursor: pointer;
    text-align: left;
    font-size: 14px;
  }

  .add-card-btn:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .add-card-form {
    margin-top: 4px;
  }

  .add-card-form textarea {
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: inherit;
    resize: none;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .add-card-actions,
  .add-list-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }

  .btn-primary-sm {
    padding: 6px 12px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 0 6px;
  }

  .add-list {
    flex-shrink: 0;
    width: 272px;
  }

  .add-list-btn {
    width: 100%;
    padding: 12px;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    border-radius: var(--radius);
    color: var(--color-text-subtle);
    cursor: pointer;
    text-align: left;
    font-size: 14px;
  }

  .add-list-btn:hover {
    background: rgba(255, 255, 255, 0.5);
  }

  .add-list form {
    padding: 8px;
    background: #ebecf0;
    border-radius: var(--radius);
  }

  .add-list input {
    width: 100%;
    padding: 8px;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-sm);
    font-size: 14px;
    margin-bottom: 4px;
  }

  :global(.dragged) {
    opacity: 0.8;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
</style>
