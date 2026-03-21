<script lang="ts">
  import { api } from '$lib/api';
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import { dndzone } from 'svelte-dnd-action';
  import { generateKeyBetween } from '@kanbang/shared';

  interface CardItem {
    id: string;
    title: string;
    description: string | null;
    listId: string;
    position: string;
    completed: boolean;
  }

  interface ListItem {
    id: string;
    name: string;
    boardId: string;
    position: string;
    cards: CardItem[];
  }

  interface ArchivedListEntry {
    id: string;
    name: string;
    archivedAt: string;
    cards: CardItem[];
  }

  interface ArchivedCardEntry {
    id: string;
    title: string;
    listId: string;
    listName: string;
    position: string;
    completed: boolean;
    archivedAt: string;
  }

  interface ArchivedItems {
    archivedLists: ArchivedListEntry[];
    archivedCards: ArchivedCardEntry[];
  }

  let { data } = $props();

  let lists: ListItem[] = $state(data.board.lists.map((l: ListItem) => ({
    ...l,
    cards: l.cards.map((c: CardItem) => ({ ...c })),
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

  async function archiveBoard() {
    await api(`/boards/${data.board.id}/archive`, { method: 'PATCH' });
    goto('/boards');
  }

  // --- List actions ---
  let addingList = $state(false);
  let newListName = $state('');

  async function addList(e: Event) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const { list } = await api<{ list: ListItem }>(`/boards/${data.board.id}/lists`, {
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

  async function archiveList(listId: string) {
    await api(`/lists/${listId}/archive`, { method: 'PATCH' });
    lists = lists.filter((l) => l.id !== listId);
    archivedItems = null;
  }

  // --- Card actions ---
  async function addCard(listId: string, title: string) {
    const { card } = await api<{ card: CardItem }>(`/lists/${listId}/cards`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    const listIndex = lists.findIndex((l) => l.id === listId);
    lists[listIndex].cards = [...lists[listIndex].cards, card];
  }

  async function updateCard(cardId: string, updates: { title?: string; description?: string | null }) {
    await api(`/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async function toggleCardCompleted(cardId: string, listId: string, completed: boolean) {
    await api(`/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
    const listIndex = lists.findIndex((l) => l.id === listId);
    const card = lists[listIndex].cards.find((c) => c.id === cardId);
    if (card) card.completed = completed;
  }

  async function archiveCard(cardId: string, listId: string) {
    await api(`/cards/${cardId}/archive`, { method: 'PATCH' });
    const listIndex = lists.findIndex((l) => l.id === listId);
    lists[listIndex].cards = lists[listIndex].cards.filter((c) => c.id !== cardId);
    archivedItems = null;
  }

  // --- Drag and drop ---
  function computePosition(items: { position: string }[], index: number): string {
    const before = index > 0 ? items[index - 1].position : null;
    const after = index < items.length - 1 ? items[index + 1].position : null;
    return generateKeyBetween(before, after);
  }

  function handleListConsider(e: CustomEvent<{ items: ListItem[] }>) {
    lists = e.detail.items;
  }

  async function handleListFinalize(e: CustomEvent<{ items: ListItem[]; info: { id: string } }>) {
    const newLists = e.detail.items;
    const info = e.detail.info;

    lists = newLists;

    const movedIndex = newLists.findIndex((l) => l.id === info.id);
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

  function handleCardConsider(listId: string, e: CustomEvent<{ items: CardItem[] }>) {
    const listIndex = lists.findIndex((l) => l.id === listId);
    lists[listIndex].cards = e.detail.items;
  }

  async function handleCardFinalize(listId: string, e: CustomEvent<{ items: CardItem[]; info: { id: string } }>) {
    const { items, info } = e.detail;
    const listIndex = lists.findIndex((l) => l.id === listId);
    lists[listIndex].cards = items;

    const movedIndex = items.findIndex((c) => c.id === info.id);
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
      const idx = lists.findIndex((l) => l.id === editingListId);
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
        const card = list.cards.find((c) => c.id === editingCardId);
        if (card) {
          card.title = editingCardTitle.trim();
          break;
        }
      }
    }
    editingCardId = null;
  }

  // --- Archived items panel ---
  let showArchived = $state(false);
  let archivedItems = $state<ArchivedItems | null>(null);
  let loadingArchived = $state(false);

  async function toggleArchived() {
    if (!showArchived && !archivedItems) {
      loadingArchived = true;
      try {
        const result = await api<ArchivedItems>(`/boards/${data.board.id}/archived`);
        archivedItems = result;
      } finally {
        loadingArchived = false;
      }
    }
    showArchived = !showArchived;
  }

  async function unarchiveList(listId: string) {
    await api(`/lists/${listId}/unarchive`, { method: 'PATCH' });
    if (archivedItems) {
      archivedItems.archivedLists = archivedItems.archivedLists.filter((l) => l.id !== listId);
    }
    const { board } = await api<{ board: { lists: ListItem[] } }>(`/boards/${data.board.id}`);
    lists = board.lists.map((l) => ({ ...l, cards: l.cards.map((c) => ({ ...c })) }));
  }

  async function unarchiveCard(cardId: string) {
    await api(`/cards/${cardId}/unarchive`, { method: 'PATCH' });
    if (archivedItems) {
      archivedItems.archivedCards = archivedItems.archivedCards.filter((c) => c.id !== cardId);
    }
    const { board } = await api<{ board: { lists: ListItem[] } }>(`/boards/${data.board.id}`);
    lists = board.lists.map((l) => ({ ...l, cards: l.cards.map((c) => ({ ...c })) }));
  }
</script>

<div class="board-page">
  <header class="board-header">
    {#if editingBoardName}
      <!-- svelte-ignore a11y_autofocus -->
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
    <button class="btn-archive-board" onclick={archiveBoard}>Archive Board</button>
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
            <!-- svelte-ignore a11y_autofocus -->
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
          <button class="list-archive" onclick={() => archiveList(list.id)} aria-label="Archive list">
            <svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor">
              <rect x="0" y="0" width="14" height="3.5" rx="1"/>
              <rect x="1" y="4.5" width="12" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
              <path d="M5 8.5h4M7 7v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div
          class="card-list"
          use:dndzone={{ items: list.cards, type: 'card', flipDurationMs, dropTargetStyle: {} }}
          onconsider={(e) => handleCardConsider(list.id, e)}
          onfinalize={(e) => handleCardFinalize(list.id, e)}
        >
          {#each list.cards as card (card.id)}
            <div class="card-item">
              <button
                class="card-checkbox"
                class:card-checkbox-checked={card.completed}
                onclick={(e) => { e.stopPropagation(); toggleCardCompleted(card.id, list.id, !card.completed); }}
                aria-label={card.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {#if card.completed}
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <rect width="16" height="16" rx="2" fill="#22c55e"/>
                    <path d="M4 8l3 3 5-5" stroke="white" stroke-width="2"
                    fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                {:else}
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <rect x="0.5" y="0.5" width="15" height="15" rx="1.5"
                    fill="none" stroke="#b0b0b0" stroke-width="1"/>
                  </svg>
                {/if}
              </button>
              {#if editingCardId === card.id}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  class="card-title-input"
                  bind:value={editingCardTitle}
                  onblur={saveCardTitle}
                  onkeydown={(e) => e.key === 'Enter' && saveCardTitle()}
                  autofocus
                />
              {:else}
                <span class="card-title" class:card-title-completed={card.completed}
                 ondblclick={() => startEditCard(card.id, card.title)}>
                  {card.title}
                </span>
              {/if}
              <button
                class="card-archive"
                onclick={() => archiveCard(card.id, list.id)}
                aria-label="Archive card"
              >
                <svg viewBox="0 0 14 14" width="11" height="11" fill="currentColor">
                  <rect x="0" y="0" width="14" height="3.5" rx="1"/>
                  <rect x="1" y="4.5" width="12" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M5 8.5h4M7 7v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>

        {#if addingCardToList === list.id}
          <form class="add-card-form" onsubmit={(e) => submitNewCard(e, list.id)}>
            <!-- svelte-ignore a11y_autofocus -->
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
          <!-- svelte-ignore a11y_autofocus -->
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

  <!-- Archived items panel -->
  <div class="archived-panel">
    <button class="archived-toggle" onclick={toggleArchived}>
      {showArchived ? '▾' : '▸'} Archived items
    </button>

    {#if showArchived}
      <div class="archived-content">
        {#if loadingArchived}
          <p class="archived-msg">Loading…</p>
        {:else if archivedItems && (archivedItems.archivedLists.length > 0 || archivedItems.archivedCards.length > 0)}
          {#if archivedItems.archivedLists.length > 0}
            <p class="archived-group-label">Archived lists</p>
            <div class="archived-list">
              {#each archivedItems.archivedLists as list (list.id)}
                <div class="archived-entry">
                  <span class="archived-entry-name">{list.name}</span>
                  <span class="archived-entry-meta">{list.cards.length} card{list.cards.length !== 1 ? 's' : ''}</span>
                  <button class="btn-unarchive" onclick={() => unarchiveList(list.id)}>Unarchive</button>
                </div>
              {/each}
            </div>
          {/if}

          {#if archivedItems.archivedCards.length > 0}
            <p class="archived-group-label">Archived cards</p>
            <div class="archived-list">
              {#each archivedItems.archivedCards as card (card.id)}
                <div class="archived-entry">
                  <span class="archived-entry-name">{card.title}</span>
                  <span class="archived-entry-meta">in {card.listName}</span>
                  <button class="btn-unarchive" onclick={() => unarchiveCard(card.id)}>Unarchive</button>
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <p class="archived-msg">Nothing archived yet.</p>
        {/if}
      </div>
    {/if}
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

  .btn-archive-board {
    padding: 6px 12px;
    background: none;
    color: var(--color-text-subtle);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
  }

  .btn-archive-board:hover {
    background: var(--color-surface, #f5f5f5);
    color: var(--color-text);
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

  .list-archive {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 2px 4px;
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 150ms;
  }

  .list-header:hover .list-archive {
    opacity: 1;
  }

  .list-archive:hover {
    color: var(--color-text);
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

  .card-checkbox {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-right: 6px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 150ms;
    display: flex;
    align-items: center;
  }

  .card-checkbox-checked {
    opacity: 1;
  }

  .card-item:hover .card-checkbox {
    opacity: 1;
  }

  .card-title-completed {
    opacity: 0.6;
  }

  .card-archive {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 1px 2px;
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 150ms;
    flex-shrink: 0;
  }

  .card-item:hover .card-archive {
    opacity: 1;
  }

  .card-archive:hover {
    color: var(--color-text);
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

  /* Archived panel */
  .archived-panel {
    flex-shrink: 0;
    border-top: 1px solid var(--color-border);
    padding: 8px 16px;
    background: var(--color-bg, white);
  }

  .archived-toggle {
    background: none;
    border: none;
    font-size: 13px;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 0;
  }

  .archived-toggle:hover {
    color: var(--color-text);
  }

  .archived-content {
    margin-top: 10px;
    max-height: 220px;
    overflow-y: auto;
  }

  .archived-group-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-subtle);
    margin: 8px 0 4px;
  }

  .archived-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  .archived-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: var(--color-surface, #f5f5f5);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }

  .archived-entry-name {
    font-size: 13px;
    flex: 1;
    color: var(--color-text-subtle);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .archived-entry-meta {
    font-size: 12px;
    color: var(--color-text-subtle);
    opacity: 0.7;
    white-space: nowrap;
  }

  .btn-unarchive {
    padding: 3px 8px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    cursor: pointer;
    color: var(--color-text-subtle);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn-unarchive:hover {
    background: white;
    color: var(--color-text);
  }

  .archived-msg {
    font-size: 13px;
    color: var(--color-text-subtle);
    margin: 4px 0;
  }

  :global(.dragged) {
    opacity: 0.8;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
</style>
