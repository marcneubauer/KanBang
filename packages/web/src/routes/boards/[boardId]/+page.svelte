<script lang="ts">
  import { api } from '$lib/api';
  import { invalidateAll } from '$app/navigation';
  import { SvelteSet } from 'svelte/reactivity';
  import { dndzone } from 'svelte-dnd-action';
  import { generateKeyBetween, resolveBoardBackground, resolveBoardAccent, type BackgroundType } from '@kanbang/shared';
  import type { Card, CardWithProgress, Label, ListWithCardsDetail } from '@kanbang/shared';
  import { cardMatchesFilter, isFilterActive, type CardFilter, type DueFilter } from '$lib/utils/card-filter';
  import { toastStore } from '$lib/toastStore.svelte';
  import CardDetailModal from '$lib/components/CardDetailModal.svelte';
  import BoardSettingsModal from '$lib/components/BoardSettingsModal.svelte';
  import ListColumn from '$lib/components/board/ListColumn.svelte';
  import ArchivedPanel, { type ArchivedItems } from '$lib/components/board/ArchivedPanel.svelte';

  let { data } = $props();

  let lists: ListWithCardsDetail[] = $state(data.board.lists.map((l: ListWithCardsDetail) => ({
    ...l,
    cards: l.cards.map((c: CardWithProgress) => ({ ...c })),
  })));

  let boardLabels: Label[] = $state(data.board.labels);
  let cardAgingDays = $state<number | null>(data.board.cardAgingDays ?? null);
  let boardBackground = $state<{ type: BackgroundType | null; value: string | null }>({
    type: data.board.backgroundType ?? null,
    value: data.board.backgroundValue ?? null,
  });

  let backgroundCss = $derived(resolveBoardBackground(boardBackground.type, boardBackground.value));
  let accentColor = $derived(resolveBoardAccent(boardBackground.type, boardBackground.value));

  const flipDurationMs = 200;

  interface BoardResponse {
    name: string;
    lists: ListWithCardsDetail[];
    labels: Label[];
    cardAgingDays: number | null;
    backgroundType: BackgroundType | null;
    backgroundValue: string | null;
  }

  async function refetchBoard() {
    const { board } = await api<{ board: BoardResponse }>(`/boards/${data.board.id}`);
    lists = board.lists.map((l) => ({ ...l, cards: l.cards.map((c) => ({ ...c })) }));
    boardLabels = board.labels;
    cardAgingDays = board.cardAgingDays;
    boardBackground = { type: board.backgroundType, value: board.backgroundValue };
    return board;
  }

  // --- Card filtering (search text, labels, due date) ---
  const filterLabelIds = new SvelteSet<string>();
  let searchQuery = $state('');
  let dueFilter = $state<DueFilter>('any');

  let cardFilter = $derived<CardFilter>({ query: searchQuery, labelIds: filterLabelIds, due: dueFilter });
  let filterActive = $derived(isFilterActive(cardFilter));

  function isCardDimmed(card: CardWithProgress): boolean {
    return filterActive && !cardMatchesFilter(card, cardFilter);
  }

  function toggleFilterLabel(labelId: string) {
    if (filterLabelIds.has(labelId)) {
      filterLabelIds.delete(labelId);
    } else {
      filterLabelIds.add(labelId);
    }
  }

  function clearFilters() {
    searchQuery = '';
    dueFilter = 'any';
    filterLabelIds.clear();
  }

  // --- List collapse ---
  function loadCollapsedLists(boardId: string, allLists: ListWithCardsDetail[]): Set<string> {
    try {
      const raw = localStorage.getItem(`kanbang:collapsed-lists:${boardId}`);
      const saved: SvelteSet<string> = raw ? new SvelteSet(JSON.parse(raw)) : new SvelteSet();

      // Done lists default to collapsed if user hasn't explicitly expanded them
      const explicitKey = `kanbang:collapse-explicit:${boardId}`;
      const explicitRaw = localStorage.getItem(explicitKey);
      const explicitIds: Set<string> = explicitRaw ? new Set(JSON.parse(explicitRaw)) : new Set();

      for (const list of allLists) {
        if (list.isDone && !explicitIds.has(list.id)) {
          saved.add(list.id);
        }
      }

      return saved;
    } catch {
      return new Set();
    }
  }

  function saveCollapsedLists(boardId: string, ids: Set<string>) {
    localStorage.setItem(`kanbang:collapsed-lists:${boardId}`, JSON.stringify([...ids]));
  }

  function markExplicitCollapse(boardId: string, listId: string) {
    try {
      const key = `kanbang:collapse-explicit:${boardId}`;
      const raw = localStorage.getItem(key);
      const explicit: SvelteSet<string> = raw ? new SvelteSet(JSON.parse(raw)) : new SvelteSet();
      explicit.add(listId);
      localStorage.setItem(key, JSON.stringify([...explicit]));
    } catch {
      // ignore
    }
  }

  let collapsedListIds = $state<Set<string>>(loadCollapsedLists(data.board.id, lists));

  // --- Done list separation ---
  let regularLists = $derived(lists.filter((l) => !l.isDone));
  let doneList = $derived(lists.find((l) => l.isDone) ?? null);

  function toggleCollapse(listId: string) {
    if (collapsedListIds.has(listId)) {
      collapsedListIds.delete(listId);
    } else {
      collapsedListIds.add(listId);
    }
    collapsedListIds = new SvelteSet(collapsedListIds);
    saveCollapsedLists(data.board.id, collapsedListIds);
    markExplicitCollapse(data.board.id, listId);
  }

  // --- Board-level error message ---
  let boardError = $state('');

  // --- Board actions ---
  let editingBoardName = $state(false);
  let boardName = $state(data.board.name);
  let showSettings = $state(false);

  async function saveBoardName() {
    if (!boardName.trim()) return;
    await api(`/boards/${data.board.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: boardName.trim() }),
    });
    editingBoardName = false;
  }

  // --- List actions ---
  let addingList = $state(false);
  let newListName = $state('');

  async function addList(e: Event) {
    e.preventDefault();
    if (!newListName.trim()) return;
    const { list } = await api<{ list: ListWithCardsDetail }>(`/boards/${data.board.id}/lists`, {
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
    const listName = lists.find((l) => l.id === listId)?.name;
    await api(`/lists/${listId}/archive`, { method: 'PATCH' });
    lists = lists.filter((l) => l.id !== listId);
    archivedItems = null;
    toastStore.show(`List "${listName ?? 'list'}" archived`, {
      actionLabel: 'Undo',
      action: async () => {
        await api(`/lists/${listId}/unarchive`, { method: 'PATCH' });
        archivedItems = null;
        await refetchBoard();
      },
    });
  }

  async function sortList(listId: string, by: 'name' | 'dueDate' | 'createdAt', direction: 'asc' | 'desc') {
    const { cards } = await api<{ cards: Card[] }>(`/lists/${listId}/sort`, {
      method: 'PATCH',
      body: JSON.stringify({ by, direction }),
    });
    const listIndex = lists.findIndex((l) => l.id === listId);
    if (listIndex === -1) return;
    // Reorder the existing rich card objects; only positions changed server-side
    const order = new Map(cards.map((c, i) => [c.id, i]));
    const positions = new Map(cards.map((c) => [c.id, c.position]));
    lists[listIndex].cards = [...lists[listIndex].cards]
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((c) => ({ ...c, position: positions.get(c.id) ?? c.position }));
  }

  // Other boards for the "Move to board" list menu action
  let allBoards = $state<Array<{ id: string; name: string }>>([]);
  $effect(() => {
    api<{ boards: Array<{ id: string; name: string }> }>('/boards').then(({ boards }) => {
      allBoards = boards;
    });
  });
  let otherBoards = $derived(allBoards.filter((b) => b.id !== data.board.id));

  async function copyList(listId: string) {
    await api(`/lists/${listId}/copy`, { method: 'POST' });
    await refetchBoard();
  }

  async function moveListToBoard(listId: string, targetBoardId: string) {
    const listName = lists.find((l) => l.id === listId)?.name;
    await api(`/lists/${listId}/move-to-board`, {
      method: 'PATCH',
      body: JSON.stringify({ boardId: targetBoardId }),
    });
    lists = lists.filter((l) => l.id !== listId);
    const boardName = allBoards.find((b) => b.id === targetBoardId)?.name;
    toastStore.show(`List "${listName ?? 'list'}" moved to ${boardName ?? 'board'}`);
  }

  async function addFromTemplate(listId: string, templateCardId: string) {
    await api(`/cards/${templateCardId}/copy`, {
      method: 'POST',
      body: JSON.stringify({ listId }),
    });
    await refetchBoard();
  }

  async function setCardLimit(listId: string, cardLimit: number | null) {
    const { list } = await api<{ list: ListWithCardsDetail }>(`/lists/${listId}`, {
      method: 'PATCH',
      body: JSON.stringify({ cardLimit }),
    });
    const idx = lists.findIndex((l) => l.id === listId);
    if (idx !== -1) lists[idx].cardLimit = list.cardLimit;
  }

  // --- Card actions ---
  async function addCard(listId: string, title: string) {
    const { card } = await api<{ card: Card }>(`/lists/${listId}/cards`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    const listIndex = lists.findIndex((l) => l.id === listId);
    lists[listIndex].cards = [
      ...lists[listIndex].cards,
      { ...card, checklistProgress: { total: 0, completed: 0 }, labelIds: [], commentCount: 0 },
    ];
  }

  async function updateCard(cardId: string, updates: { title?: string; description?: string | null }) {
    await api(`/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async function setCardDueDate(cardId: string, listId: string, dueDate: string | null) {
    await api(`/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ dueDate }),
    });
    const listIndex = lists.findIndex((l) => l.id === listId);
    const card = lists[listIndex].cards.find((c) => c.id === cardId);
    if (card) card.dueDate = dueDate;
  }

  async function toggleCardCompleted(cardId: string, listId: string, completed: boolean) {
    const { card: updatedCard } = await api<{ card: Card }>(`/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });

    if (updatedCard.listId !== listId) {
      // Card was auto-moved to Done list
      const oldListIdx = lists.findIndex((l) => l.id === listId);
      if (oldListIdx !== -1) {
        lists[oldListIdx].cards = lists[oldListIdx].cards.filter((c) => c.id !== cardId);
      }
      const newListIdx = lists.findIndex((l) => l.id === updatedCard.listId);
      if (newListIdx !== -1) {
        lists[newListIdx].cards = [
          ...lists[newListIdx].cards,
          { ...updatedCard, checklistProgress: { total: 0, completed: 0 }, labelIds: [], commentCount: 0 },
        ];
      }
    } else {
      // Just update completed status in place
      const listIndex = lists.findIndex((l) => l.id === listId);
      const card = lists[listIndex].cards.find((c) => c.id === cardId);
      if (card) {
        card.completed = completed;
        card.completedAt = updatedCard.completedAt;
      }
    }
  }

  async function archiveCard(cardId: string, listId: string) {
    const cardTitle = findCard(cardId, listId)?.title;
    await api(`/cards/${cardId}/archive`, { method: 'PATCH' });
    const listIndex = lists.findIndex((l) => l.id === listId);
    lists[listIndex].cards = lists[listIndex].cards.filter((c) => c.id !== cardId);
    archivedItems = null;
    toastStore.show(`Card "${cardTitle ?? 'card'}" archived`, {
      actionLabel: 'Undo',
      action: async () => {
        await api(`/cards/${cardId}/unarchive`, { method: 'PATCH' });
        archivedItems = null;
        await refetchBoard();
      },
    });
  }

  // --- Drag and drop ---
  // svelte-dnd-action is mouse-only; the card detail modal's Move section is
  // the keyboard-accessible alternative for moving cards. List reordering
  // still has no keyboard path.
  function computePosition(items: { position: string }[], index: number): string {
    const before = index > 0 ? items[index - 1].position : null;
    const after = index < items.length - 1 ? items[index + 1].position : null;
    return generateKeyBetween(before, after);
  }

  function handleListConsider(e: CustomEvent<{ items: ListWithCardsDetail[] }>) {
    const done = lists.filter((l) => l.isDone);
    lists = [...e.detail.items, ...done];
  }

  async function handleListFinalize(e: CustomEvent<{ items: ListWithCardsDetail[]; info: { id: string } }>) {
    const newRegularLists = e.detail.items;
    const info = e.detail.info;
    const done = lists.filter((l) => l.isDone);

    lists = [...newRegularLists, ...done];

    const movedIndex = newRegularLists.findIndex((l) => l.id === info.id);
    if (movedIndex === -1) return;

    const newPosition = computePosition(newRegularLists, movedIndex);

    try {
      await api(`/lists/${info.id}/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ position: newPosition }),
      });
      const globalIdx = lists.findIndex((l) => l.id === info.id);
      if (globalIdx !== -1) lists[globalIdx].position = newPosition;
    } catch {
      boardError = 'Failed to reorder list. Refreshing board...';
      invalidateAll();
    }
  }

  function handleCardConsider(listId: string, e: CustomEvent<{ items: CardWithProgress[] }>) {
    const listIndex = lists.findIndex((l) => l.id === listId);
    lists[listIndex].cards = e.detail.items;
  }

  async function handleCardFinalize(
    listId: string,
    e: CustomEvent<{ items: CardWithProgress[]; info: { id: string } }>,
  ) {
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
      boardError = 'Failed to move card. Refreshing board...';
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
  let datePickerCardId = $state<string | null>(null);
  let quickEditCardId = $state<string | null>(null);

  // --- Quick-edit actions ---
  function findCard(cardId: string, listId: string) {
    const listIndex = lists.findIndex((l) => l.id === listId);
    return listIndex === -1 ? undefined : lists[listIndex].cards.find((c) => c.id === cardId);
  }

  async function quickSaveTitle(cardId: string, listId: string, title: string) {
    await updateCard(cardId, { title });
    const card = findCard(cardId, listId);
    if (card) card.title = title;
  }

  async function toggleCardLabel(cardId: string, listId: string, labelId: string, assign: boolean) {
    await api(`/cards/${cardId}/labels/${labelId}`, { method: assign ? 'POST' : 'DELETE' });
    const card = findCard(cardId, listId);
    if (card) {
      card.labelIds = assign
        ? [...card.labelIds, labelId]
        : card.labelIds.filter((id) => id !== labelId);
    }
  }

  // --- Card detail modal ---
  let modalCard = $state<{ id: string; title: string; description: string | null; listId: string; isTemplate: boolean } | null>(null);
  let clickTimer: ReturnType<typeof setTimeout> | null = null;

  function handleCardClick(card: CardWithProgress, listId: string) {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      startEditCard(card.id, card.title);
    } else {
      clickTimer = setTimeout(() => {
        clickTimer = null;
        modalCard = { id: card.id, title: card.title, description: card.description, listId, isTemplate: card.isTemplate };
      }, 250);
    }
  }

  async function handleModalUpdated() {
    await refetchBoard();
    if (modalCard) {
      for (const list of lists) {
        const card = list.cards.find((c) => c.id === modalCard!.id);
        if (card) {
          modalCard = { id: card.id, title: card.title, description: card.description, listId: list.id, isTemplate: card.isTemplate };
          break;
        }
      }
    }
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
  let archivedItems = $state<ArchivedItems | null>(null);

  let modalCardLabelIds = $derived(
    modalCard
      ? lists.flatMap((l) => l.cards).find((c) => c.id === modalCard!.id)?.labelIds ?? []
      : [],
  );
</script>

<div
  class="board-page"
  class:board-page-bg={!!backgroundCss}
  style:background={backgroundCss || undefined}
  style:--color-primary={accentColor || undefined}
  style:--color-primary-hover={accentColor ? `color-mix(in srgb, ${accentColor} 82%, black)` : undefined}
>
  {#if boardError}
    <div class="board-error" role="alert">
      {boardError}
      <button class="board-error-dismiss" onclick={() => { boardError = ''; }}>&times;</button>
    </div>
  {/if}
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
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <h1
        class="board-name"
        ondblclick={() => { editingBoardName = true; }}
        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editingBoardName = true; } }}
        tabindex="0"
      >{boardName}</h1>
    {/if}
    <div class="board-filter" role="group" aria-label="Filter cards">
      <input
        class="filter-search"
        type="search"
        placeholder="Search cards..."
        bind:value={searchQuery}
        aria-label="Search cards"
      />
      {#each boardLabels as label (label.id)}
        <button
          class="label-filter-chip"
          class:label-filter-active={filterLabelIds.has(label.id)}
          style="background: {label.color}"
          title={label.name || 'Unnamed label'}
          aria-pressed={filterLabelIds.has(label.id)}
          onclick={() => toggleFilterLabel(label.id)}
        >
          {label.name}
        </button>
      {/each}
      <select class="filter-due" bind:value={dueFilter} aria-label="Filter by due date">
        <option value="any">Due: any</option>
        <option value="overdue">Overdue</option>
        <option value="soon">Due soon</option>
        <option value="has">Has due date</option>
        <option value="none">No due date</option>
      </select>
      {#if filterActive}
        <button class="label-filter-clear" onclick={clearFilters}>
          Clear
        </button>
      {/if}
    </div>
    <button class="board-header-btn" onclick={() => { showSettings = true; }} aria-label="Board settings">
      <svg viewBox="0 0 14 14" width="14" height="14"
        fill="none" stroke="currentColor" stroke-width="1.2"
        stroke-linecap="round" stroke-linejoin="round">
        <circle cx="7" cy="7" r="2.5"/>
        <path d="M5.7 1.5h2.6l.3 1.6a4.5 4.5 0 011.1.6l1.5-.6 1.3 2.3-1.2 1a4.5 4.5 0 010 1.2l1.2 1
          -1.3 2.3-1.5-.6a4.5 4.5 0 01-1.1.6l-.3 1.6H5.7l-.3-1.6a4.5 4.5 0 01-1.1-.6l-1.5.6
          -1.3-2.3 1.2-1a4.5 4.5 0 010-1.2l-1.2-1 1.3-2.3 1.5.6a4.5 4.5 0 011.1-.6z"/>
      </svg>
    </button>
  </header>

  <div class="board-columns-wrapper">
  <div
    class="board-columns"
    use:dndzone={{ items: regularLists, type: 'list', flipDurationMs, dropTargetStyle: {} }}
    onconsider={handleListConsider}
    onfinalize={handleListFinalize}
  >
    {#each regularLists as list (list.id)}
      <ListColumn
        {list}
        collapsed={collapsedListIds.has(list.id)}
        {flipDurationMs}
        {boardLabels}
        {cardAgingDays}
        {isCardDimmed}
        bind:editingListId
        bind:editingListName
        bind:editingCardId
        bind:editingCardTitle
        bind:addingCardToList
        bind:newCardTitle
        bind:datePickerCardId
        bind:quickEditCardId
        ontogglecollapse={() => toggleCollapse(list.id)}
        onarchivelist={() => archiveList(list.id)}
        onsortlist={(by, direction) => sortList(list.id, by, direction)}
        onsetcardlimit={(limit) => setCardLimit(list.id, limit)}
        {otherBoards}
        oncopylist={() => copyList(list.id)}
        onmovelisttoboard={(targetBoardId) => moveListToBoard(list.id, targetBoardId)}
        onsavelistname={saveListName}
        onsavecardtitle={saveCardTitle}
        onsubmitnewcard={(e) => submitNewCard(e, list.id)}
        onaddfromtemplate={(templateCardId) => addFromTemplate(list.id, templateCardId)}
        oncardclick={(card) => handleCardClick(card, list.id)}
        ontogglecardcompleted={(cardId, completed) => toggleCardCompleted(cardId, list.id, completed)}
        onarchivecard={(cardId) => archiveCard(cardId, list.id)}
        onsetcardduedate={(cardId, date) => setCardDueDate(cardId, list.id, date)}
        onquicksavetitle={(cardId, title) => quickSaveTitle(cardId, list.id, title)}
        ontogglecardlabel={(cardId, labelId, assign) => toggleCardLabel(cardId, list.id, labelId, assign)}
        oncardconsider={(e) => handleCardConsider(list.id, e)}
        oncardfinalize={(e) => handleCardFinalize(list.id, e)}
      />
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

  <!-- Done list (outside dnd zone, positioned on right) -->
  {#if doneList}
    <ListColumn
      list={doneList}
      collapsed={collapsedListIds.has(doneList.id)}
      {flipDurationMs}
      {boardLabels}
      {cardAgingDays}
      {isCardDimmed}
      bind:editingListId
      bind:editingListName
      bind:editingCardId
      bind:editingCardTitle
      bind:addingCardToList
      bind:newCardTitle
      bind:datePickerCardId
      bind:quickEditCardId
      ontogglecollapse={() => toggleCollapse(doneList!.id)}
      onarchivelist={() => archiveList(doneList!.id)}
      onsortlist={(by, direction) => sortList(doneList!.id, by, direction)}
      onsetcardlimit={(limit) => setCardLimit(doneList!.id, limit)}
      {otherBoards}
      oncopylist={() => copyList(doneList!.id)}
      onmovelisttoboard={(targetBoardId) => moveListToBoard(doneList!.id, targetBoardId)}
      onsavelistname={saveListName}
      onsavecardtitle={saveCardTitle}
      onsubmitnewcard={(e) => submitNewCard(e, doneList!.id)}
      onaddfromtemplate={(templateCardId) => addFromTemplate(doneList!.id, templateCardId)}
      oncardclick={(card) => handleCardClick(card, doneList!.id)}
      ontogglecardcompleted={(cardId, completed) => toggleCardCompleted(cardId, doneList!.id, completed)}
      onarchivecard={(cardId) => archiveCard(cardId, doneList!.id)}
      onsetcardduedate={(cardId, date) => setCardDueDate(cardId, doneList!.id, date)}
      onquicksavetitle={(cardId, title) => quickSaveTitle(cardId, doneList!.id, title)}
      ontogglecardlabel={(cardId, labelId, assign) => toggleCardLabel(cardId, doneList!.id, labelId, assign)}
      oncardconsider={(e) => handleCardConsider(doneList!.id, e)}
      oncardfinalize={(e) => handleCardFinalize(doneList!.id, e)}
    />
  {/if}
  </div>

  <ArchivedPanel boardId={data.board.id} bind:archivedItems onrestored={async () => { await refetchBoard(); }} />

  {#if modalCard}
    <CardDetailModal
      cardId={modalCard.id}
      cardTitle={modalCard.title}
      cardDescription={modalCard.description}
      cardIsTemplate={modalCard.isTemplate}
      listId={modalCard.listId}
      boardId={data.board.id}
      defaultLabelColor={accentColor || undefined}
      {boardLabels}
      cardLabelIds={modalCardLabelIds}
      {lists}
      onclose={() => { modalCard = null; }}
      onupdated={handleModalUpdated}
    />
  {/if}

  {#if showSettings}
    <BoardSettingsModal
      boardId={data.board.id}
      boardName={boardName}
      {cardAgingDays}
      background={boardBackground}
      lists={lists.map((l) => ({ id: l.id, name: l.name, isDone: l.isDone }))}
      onclose={() => { showSettings = false; }}
      onupdated={async () => {
        const board = await refetchBoard();
        boardName = board.name;
        showSettings = false;
      }}
    />
  {/if}
</div>

<style>
  .board-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* With a custom background, columns get a translucent frosted treatment
     and the header text switches to white for contrast */
  .board-page-bg :global(.list-column),
  .board-page-bg :global(.list-collapsed) {
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(4px);
  }

  .board-page-bg .board-name,
  .board-page-bg .board-header-btn {
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .board-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: #fdf2f2;
    color: var(--color-danger);
    font-size: 13px;
    flex-shrink: 0;
  }

  .board-error-dismiss {
    background: none;
    border: none;
    color: var(--color-danger);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
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

  .board-filter {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin-left: auto;
    margin-right: 12px;
  }

  .filter-search {
    padding: 4px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 13px;
    width: 180px;
  }

  .filter-search:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .filter-due {
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 13px;
    background: white;
    color: var(--color-text);
    cursor: pointer;
  }

  .label-filter-chip {
    border: 2px solid transparent;
    border-radius: 3px;
    padding: 2px 8px;
    min-width: 28px;
    min-height: 18px;
    font-size: 11px;
    font-weight: 600;
    color: white;
    cursor: pointer;
    opacity: 0.55;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.35);
    transition: opacity 150ms, border-color 150ms;
  }

  .label-filter-chip:hover {
    opacity: 0.85;
  }

  .label-filter-active {
    opacity: 1;
    border-color: var(--color-text);
  }

  .label-filter-clear {
    background: none;
    border: none;
    font-size: 12px;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 2px 6px;
  }

  .label-filter-clear:hover {
    color: var(--color-text);
  }

  .board-header-btn {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    transition: color 150ms, background 150ms, opacity 150ms;
    opacity: 0;
  }

  .board-header:hover .board-header-btn {
    opacity: 1;
  }

  .board-header-btn:hover {
    color: var(--color-text);
    background: rgba(0, 0, 0, 0.08);
  }

  .board-columns-wrapper {
    display: flex;
    gap: 12px;
    padding: 0 16px 16px;
    overflow-x: auto;
    flex: 1;
    align-items: flex-start;
  }

  .board-columns {
    display: flex;
    gap: 12px;
    align-items: flex-start;
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

  :global(.dragged) {
    opacity: 0.8;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
</style>
