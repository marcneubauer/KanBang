<script lang="ts">
  import { api } from '$lib/api';
  import { generateKeyBetween, type Label } from '@kanbang/shared';
  import { renderMarkdown } from '$lib/utils/markdown';
  import CardLabelsSection from './board/CardLabelsSection.svelte';

  interface MoveTargetList {
    id: string;
    name: string;
    cards: { id: string; position: string }[];
  }

  interface ChecklistItemData {
    id: string;
    title: string;
    checklistId: string;
    position: string;
    completed: boolean;
  }

  interface ChecklistData {
    id: string;
    name: string;
    cardId: string;
    position: string;
    items: ChecklistItemData[];
  }

  let { cardId, cardTitle, cardDescription, listId, boardId, boardLabels, cardLabelIds, lists, defaultLabelColor, onclose, onupdated }: {
    cardId: string;
    cardTitle: string;
    cardDescription: string | null;
    listId: string;
    boardId: string;
    boardLabels: Label[];
    cardLabelIds: string[];
    lists: MoveTargetList[];
    defaultLabelColor?: string;
    onclose: () => void;
    onupdated: () => void;
  } = $props();

  let title = $state(cardTitle);
  let description = $state(cardDescription ?? '');
  let editingTitle = $state(false);
  let editingDescription = $state(false);
  let checklists: ChecklistData[] = $state([]);
  let loading = $state(true);

  // Checklist UI state
  let newChecklistName = $state('');
  let addingChecklist = $state(false);
  let addingItemToChecklist = $state<string | null>(null);
  let newItemTitle = $state('');
  let editingChecklistId = $state<string | null>(null);
  let editingChecklistName = $state('');
  let editingItemId = $state<string | null>(null);
  let editingItemTitle = $state('');

  async function loadChecklists() {
    loading = true;
    try {
      const result = await api<{ checklists: ChecklistData[] }>(`/cards/${cardId}/checklists`);
      checklists = result.checklists;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    loadChecklists();
  });

  // --- Card title/description ---
  async function saveTitle() {
    if (title.trim() && title.trim() !== cardTitle) {
      await api(`/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: title.trim() }),
      });
      onupdated();
    }
    editingTitle = false;
  }

  async function saveDescription() {
    const desc = description.trim() || null;
    if (desc !== cardDescription) {
      await api(`/cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: desc }),
      });
      onupdated();
    }
    editingDescription = false;
  }

  // --- Checklist CRUD ---
  async function addChecklist(e: Event) {
    e.preventDefault();
    if (!newChecklistName.trim()) return;
    const { checklist } = await api<{ checklist: ChecklistData }>(`/cards/${cardId}/checklists`, {
      method: 'POST',
      body: JSON.stringify({ name: newChecklistName.trim() }),
    });
    checklists = [...checklists, checklist];
    newChecklistName = '';
    addingChecklist = false;
    onupdated();
  }

  async function renameChecklist(clId: string) {
    if (editingChecklistName.trim()) {
      await api(`/checklists/${clId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingChecklistName.trim() }),
      });
      const idx = checklists.findIndex((cl) => cl.id === clId);
      if (idx !== -1) checklists[idx].name = editingChecklistName.trim();
    }
    editingChecklistId = null;
  }

  async function deleteChecklist(clId: string) {
    await api(`/checklists/${clId}`, { method: 'DELETE' });
    checklists = checklists.filter((cl) => cl.id !== clId);
    onupdated();
  }

  // --- Item CRUD ---
  async function addItem(e: Event, checklistId: string) {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    const { item } = await api<{ item: ChecklistItemData }>(`/checklists/${checklistId}/items`, {
      method: 'POST',
      body: JSON.stringify({ title: newItemTitle.trim() }),
    });
    const idx = checklists.findIndex((cl) => cl.id === checklistId);
    if (idx !== -1) checklists[idx].items = [...checklists[idx].items, item];
    newItemTitle = '';
    onupdated();
  }

  async function toggleItem(itemId: string, checklistId: string, completed: boolean) {
    await api(`/checklist-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
    const clIdx = checklists.findIndex((cl) => cl.id === checklistId);
    if (clIdx !== -1) {
      const item = checklists[clIdx].items.find((i) => i.id === itemId);
      if (item) item.completed = completed;
    }
    onupdated();
  }

  async function saveItemTitle(itemId: string, checklistId: string) {
    if (editingItemTitle.trim()) {
      await api(`/checklist-items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editingItemTitle.trim() }),
      });
      const clIdx = checklists.findIndex((cl) => cl.id === checklistId);
      if (clIdx !== -1) {
        const item = checklists[clIdx].items.find((i) => i.id === itemId);
        if (item) item.title = editingItemTitle.trim();
      }
    }
    editingItemId = null;
  }

  async function deleteItem(itemId: string, checklistId: string) {
    await api(`/checklist-items/${itemId}`, { method: 'DELETE' });
    const clIdx = checklists.findIndex((cl) => cl.id === checklistId);
    if (clIdx !== -1) {
      checklists[clIdx].items = checklists[clIdx].items.filter((i) => i.id !== itemId);
    }
    onupdated();
  }

  async function convertToCard(itemId: string, checklistId: string) {
    await api(`/checklist-items/${itemId}/convert-to-card`, {
      method: 'POST',
      body: JSON.stringify({ listId }),
    });
    const clIdx = checklists.findIndex((cl) => cl.id === checklistId);
    if (clIdx !== -1) {
      checklists[clIdx].items = checklists[clIdx].items.filter((i) => i.id !== itemId);
    }
    onupdated();
  }

  function getProgress(cl: ChecklistData) {
    const total = cl.items.length;
    const completed = cl.items.filter((i) => i.completed).length;
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }

  // --- Move card (keyboard-accessible alternative to drag-and-drop) ---
  let moveTargetListId = $state(listId);
  let movePosition = $state(1);
  let moving = $state(false);

  // Positions available in the target list, not counting this card itself
  let moveSlotCount = $derived.by(() => {
    const target = lists.find((l) => l.id === moveTargetListId);
    if (!target) return 1;
    return target.cards.filter((c) => c.id !== cardId).length + 1;
  });

  async function moveCard(e: Event) {
    e.preventDefault();
    const target = lists.find((l) => l.id === moveTargetListId);
    if (!target) return;

    const others = target.cards.filter((c) => c.id !== cardId);
    const index = Math.min(movePosition, others.length + 1) - 1;
    const before = index > 0 ? others[index - 1].position : null;
    const after = index < others.length ? others[index].position : null;

    moving = true;
    try {
      await api(`/cards/${cardId}/move`, {
        method: 'PATCH',
        body: JSON.stringify({ listId: moveTargetListId, position: generateKeyBetween(before, after) }),
      });
      onupdated();
    } finally {
      moving = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
  <div class="modal" role="dialog" aria-modal="true">
    <button class="modal-close" onclick={onclose} aria-label="Close">&times;</button>

    <!-- Card Title -->
    <div class="modal-section">
      {#if editingTitle}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="title-input"
          bind:value={title}
          onblur={saveTitle}
          onkeydown={(e) => e.key === 'Enter' && saveTitle()}
          autofocus
        />
      {:else}
        <h2 class="title" ondblclick={() => { editingTitle = true; }} tabindex="0"
          onkeydown={(e) => { if (e.key === 'Enter') editingTitle = true; }}
        >{title}</h2>
      {/if}
    </div>

    <!-- Labels -->
    <div class="modal-section">
      <CardLabelsSection
        {cardId}
        {boardId}
        labels={boardLabels}
        labelIds={cardLabelIds}
        {defaultLabelColor}
        onchanged={onupdated}
      />
    </div>

    <!-- Move card -->
    <div class="modal-section">
      <h3 class="section-label">Move</h3>
      <form class="move-form" onsubmit={moveCard}>
        <label class="move-field">
          List
          <select bind:value={moveTargetListId} aria-label="Target list">
            {#each lists as list (list.id)}
              <option value={list.id}>{list.name}</option>
            {/each}
          </select>
        </label>
        <label class="move-field">
          Position
          <select bind:value={movePosition} aria-label="Target position">
            {#each Array.from({ length: moveSlotCount }, (_, i) => i + 1) as slot (slot)}
              <option value={slot}>{slot}</option>
            {/each}
          </select>
        </label>
        <button type="submit" class="move-btn" disabled={moving}>
          {moving ? 'Moving...' : 'Move'}
        </button>
      </form>
    </div>

    <!-- Description -->
    <div class="modal-section">
      <h3 class="section-label">Description</h3>
      {#if editingDescription}
        <!-- svelte-ignore a11y_autofocus -->
        <textarea
          class="description-textarea"
          bind:value={description}
          onblur={saveDescription}
          rows="3"
          placeholder="Add a description..."
          autofocus
        ></textarea>
      {:else}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="description-display"
          class:description-markdown={!!description}
          onclick={() => { editingDescription = true; }}
          onkeydown={(e) => { if (e.key === 'Enter') editingDescription = true; }}
          tabindex="0"
        >
          {#if description}
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown output is DOMPurify-sanitized -->
            {@html renderMarkdown(description)}
          {:else}
            Add a description...
          {/if}
        </div>
      {/if}
    </div>

    <!-- Checklists -->
    <div class="modal-section">
      {#if loading}
        <p class="loading-msg">Loading checklists…</p>
      {:else}
        {#each checklists as cl (cl.id)}
          {@const progress = getProgress(cl)}
          <div class="checklist">
            <div class="checklist-header">
              {#if editingChecklistId === cl.id}
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  class="checklist-name-input"
                  bind:value={editingChecklistName}
                  onblur={() => renameChecklist(cl.id)}
                  onkeydown={(e) => e.key === 'Enter' && renameChecklist(cl.id)}
                  autofocus
                />
              {:else}
                <h3
                  class="checklist-name"
                  ondblclick={() => { editingChecklistId = cl.id; editingChecklistName = cl.name; }}
                  tabindex="0"
                  onkeydown={(e) => { if (e.key === 'Enter') { editingChecklistId = cl.id; editingChecklistName = cl.name; } }}
                >{cl.name}</h3>
              {/if}
              <button class="checklist-delete" onclick={() => deleteChecklist(cl.id)}
                aria-label="Delete checklist">&times;</button>
            </div>

            <!-- Progress bar -->
            {#if cl.items.length > 0}
              <div class="progress-row">
                <span class="progress-text">{progress.completed}/{progress.total}</span>
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    class:progress-complete={progress.percent === 100}
                    style="width: {progress.percent}%"
                  ></div>
                </div>
              </div>
            {/if}

            <!-- Items -->
            <div class="checklist-items">
              {#each cl.items as item (item.id)}
                <div class="checklist-item">
                  <button
                    class="item-checkbox"
                    class:item-checked={item.completed}
                    onclick={() => toggleItem(item.id, cl.id, !item.completed)}
                    aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {#if item.completed}
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
                  {#if editingItemId === item.id}
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                      class="item-title-input"
                      bind:value={editingItemTitle}
                      onblur={() => saveItemTitle(item.id, cl.id)}
                      onkeydown={(e) => e.key === 'Enter' && saveItemTitle(item.id, cl.id)}
                      autofocus
                    />
                  {:else}
                    <span
                      class="item-title"
                      class:item-title-completed={item.completed}
                      ondblclick={() => { editingItemId = item.id; editingItemTitle = item.title; }}
                      tabindex="0"
                      onkeydown={(e) => { if (e.key === 'Enter') { editingItemId = item.id; editingItemTitle = item.title; } }}
                    >{item.title}</span>
                  {/if}
                  <div class="item-actions">
                    <button class="item-action-btn"
                      onclick={() => convertToCard(item.id, cl.id)}
                      aria-label="Convert to card" title="Convert to card">
                      <svg viewBox="0 0 14 14" width="12" height="12"
                        fill="none" stroke="currentColor" stroke-width="1.2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <rect x="1" y="2" width="12" height="10" rx="1"/>
                        <line x1="4" y1="5" x2="10" y2="5"/>
                        <line x1="4" y1="8" x2="7" y2="8"/>
                      </svg>
                    </button>
                    <button class="item-action-btn"
                      onclick={() => deleteItem(item.id, cl.id)}
                      aria-label="Delete item">&times;</button>
                  </div>
                </div>
              {/each}
            </div>

            <!-- Add item -->
            {#if addingItemToChecklist === cl.id}
              <form class="add-item-form" onsubmit={(e) => addItem(e, cl.id)}>
                <!-- svelte-ignore a11y_autofocus -->
                <input
                  class="add-item-input"
                  bind:value={newItemTitle}
                  placeholder="Add an item..."
                  autofocus
                />
                <div class="add-item-actions">
                  <button type="submit" class="btn-primary-sm">Add</button>
                  <button type="button" class="btn-cancel" onclick={() => { addingItemToChecklist = null; newItemTitle = ''; }}>&times;</button>
                </div>
              </form>
            {:else}
              <button class="add-item-btn" onclick={() => { addingItemToChecklist = cl.id; }}>
                + Add an item
              </button>
            {/if}
          </div>
        {/each}

        <!-- Add checklist -->
        {#if addingChecklist}
          <form class="add-checklist-form" onsubmit={addChecklist}>
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="add-checklist-input"
              bind:value={newChecklistName}
              placeholder="Checklist name..."
              autofocus
            />
            <div class="add-checklist-actions">
              <button type="submit" class="btn-primary-sm">Add Checklist</button>
              <button type="button" class="btn-cancel" onclick={() => { addingChecklist = false; newChecklistName = ''; }}>&times;</button>
            </div>
          </form>
        {:else}
          <button class="add-checklist-btn" onclick={() => { addingChecklist = true; }}>
            + Add a checklist
          </button>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 60px;
    z-index: 100;
    overflow-y: auto;
  }

  .modal {
    background: white;
    border-radius: 8px;
    width: 100%;
    max-width: 600px;
    padding: 24px;
    position: relative;
    margin-bottom: 60px;
  }

  .modal-close {
    position: absolute;
    top: 12px;
    right: 16px;
    background: none;
    border: none;
    font-size: 24px;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 0 4px;
  }

  .modal-close:hover {
    color: var(--color-text);
  }

  .modal-section {
    margin-bottom: 20px;
  }

  .title {
    font-size: 20px;
    font-weight: 600;
    cursor: pointer;
    margin: 0;
    padding-right: 32px;
  }

  .title-input {
    font-size: 20px;
    font-weight: 600;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    width: 100%;
  }

  .section-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-subtle);
    margin: 0 0 6px;
  }

  .description-textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
  }

  .move-form {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .move-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--color-text-subtle);
  }

  .move-form select {
    padding: 5px 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 13px;
    background: white;
    color: var(--color-text);
    cursor: pointer;
  }

  .move-btn {
    padding: 6px 14px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
  }

  .move-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .description-display {
    font-size: 14px;
    color: var(--color-text-subtle);
    padding: 8px;
    background: #f5f5f5;
    border-radius: var(--radius-sm);
    cursor: pointer;
    min-height: 40px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Rendered markdown: undo pre-wrap (markdown handles breaks) and style common elements */
  .description-markdown {
    white-space: normal;
    color: var(--color-text);
  }

  .description-markdown :global(p),
  .description-markdown :global(ul),
  .description-markdown :global(ol),
  .description-markdown :global(pre),
  .description-markdown :global(blockquote) {
    margin: 0 0 8px;
  }

  .description-markdown :global(*:last-child) {
    margin-bottom: 0;
  }

  .description-markdown :global(ul),
  .description-markdown :global(ol) {
    padding-left: 20px;
  }

  .description-markdown :global(h1),
  .description-markdown :global(h2),
  .description-markdown :global(h3) {
    font-size: 15px;
    margin: 8px 0 4px;
  }

  .description-markdown :global(code) {
    background: rgba(0, 0, 0, 0.07);
    border-radius: 3px;
    padding: 1px 4px;
    font-size: 13px;
  }

  .description-markdown :global(pre) {
    background: rgba(0, 0, 0, 0.07);
    border-radius: var(--radius-sm);
    padding: 8px;
    overflow-x: auto;
  }

  .description-markdown :global(pre code) {
    background: none;
    padding: 0;
  }

  .description-markdown :global(blockquote) {
    border-left: 3px solid var(--color-border);
    padding-left: 8px;
    color: var(--color-text-subtle);
  }

  .description-markdown :global(a) {
    color: var(--color-primary);
  }

  .loading-msg {
    font-size: 13px;
    color: var(--color-text-subtle);
  }

  /* Checklist */
  .checklist {
    margin-bottom: 16px;
    padding: 12px;
    background: #fafafa;
    border-radius: var(--radius-sm);
    border: 1px solid #eee;
  }

  .checklist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .checklist-name {
    font-size: 15px;
    font-weight: 600;
    margin: 0;
    cursor: pointer;
    flex: 1;
  }

  .checklist-name-input {
    font-size: 15px;
    font-weight: 600;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    flex: 1;
  }

  .checklist-delete {
    background: none;
    border: none;
    font-size: 18px;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 0 4px;
    opacity: 0;
    transition: opacity 150ms;
  }

  .checklist-header:hover .checklist-delete {
    opacity: 1;
  }

  .checklist-delete:hover {
    color: var(--color-danger, #dc2626);
  }

  /* Progress */
  .progress-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .progress-text {
    font-size: 12px;
    color: var(--color-text-subtle);
    white-space: nowrap;
    min-width: 28px;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-primary, #3b82f6);
    border-radius: 3px;
    transition: width 200ms;
  }

  .progress-complete {
    background: #22c55e;
  }

  /* Checklist items */
  .checklist-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .checklist-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 4px;
    border-radius: var(--radius-sm);
  }

  .checklist-item:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  .item-checkbox {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .item-title {
    font-size: 14px;
    flex: 1;
    cursor: pointer;
    word-break: break-word;
  }

  .item-title-completed {
    text-decoration: line-through;
    opacity: 0.6;
  }

  .item-title-input {
    font-size: 14px;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-sm);
    padding: 2px 4px;
    flex: 1;
  }

  .item-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 150ms;
  }

  .checklist-item:hover .item-actions {
    opacity: 1;
  }

  .item-action-btn {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 2px 4px;
    font-size: 14px;
    display: flex;
    align-items: center;
  }

  .item-action-btn:hover {
    color: var(--color-text);
  }

  /* Add item */
  .add-item-btn {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    font-size: 13px;
    padding: 4px 4px;
    margin-top: 4px;
  }

  .add-item-btn:hover {
    color: var(--color-text);
  }

  .add-item-form {
    margin-top: 6px;
  }

  .add-item-input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #ccc;
    border-radius: var(--radius-sm);
    font-size: 13px;
  }

  .add-item-actions,
  .add-checklist-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }

  /* Add checklist */
  .add-checklist-btn {
    background: none;
    border: 1px solid #ddd;
    border-radius: var(--radius-sm);
    color: var(--color-text-subtle);
    cursor: pointer;
    font-size: 13px;
    padding: 8px 12px;
    width: 100%;
    text-align: left;
  }

  .add-checklist-btn:hover {
    background: #f5f5f5;
    color: var(--color-text);
  }

  .add-checklist-form {
    margin-top: 4px;
  }

  .add-checklist-input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: var(--radius-sm);
    font-size: 14px;
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

  .btn-cancel {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 0 6px;
  }
</style>
