<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';
  import type { CardWithProgress, Label, ListWithCardsDetail } from '@kanbang/shared';
  import BoardCard from './BoardCard.svelte';

  type CardDndEvent = CustomEvent<{ items: CardWithProgress[]; info: { id: string } }>;

  interface Props {
    list: ListWithCardsDetail;
    collapsed: boolean;
    flipDurationMs: number;
    boardLabels?: Label[];
    cardAgingDays?: number | null;
    otherBoards?: Array<{ id: string; name: string }>;
    isCardDimmed?: (card: CardWithProgress) => boolean;
    editingListId?: string | null;
    editingListName?: string;
    editingCardId?: string | null;
    editingCardTitle?: string;
    addingCardToList?: string | null;
    newCardTitle?: string;
    datePickerCardId?: string | null;
    quickEditCardId?: string | null;
    ontogglecollapse: () => void;
    onarchivelist: () => void;
    onsortlist: (by: 'name' | 'dueDate' | 'createdAt', direction: 'asc' | 'desc') => void;
    onsetcardlimit: (limit: number | null) => void;
    oncopylist: () => void;
    onmovelisttoboard: (boardId: string) => void;
    onsavelistname: () => void;
    onsavecardtitle: () => void;
    onsubmitnewcard: (e: Event) => void;
    oncardclick: (card: CardWithProgress) => void;
    ontogglecardcompleted: (cardId: string, completed: boolean) => void;
    onarchivecard: (cardId: string) => void;
    onsetcardduedate: (cardId: string, date: string | null) => void;
    onquicksavetitle: (cardId: string, title: string) => void;
    ontogglecardlabel: (cardId: string, labelId: string, assign: boolean) => void;
    oncardconsider: (e: CardDndEvent) => void;
    oncardfinalize: (e: CardDndEvent) => void;
  }

  let {
    list,
    collapsed,
    flipDurationMs,
    boardLabels = [],
    cardAgingDays = null,
    otherBoards = [],
    isCardDimmed = () => false,
    editingListId = $bindable(null),
    editingListName = $bindable(''),
    editingCardId = $bindable(null),
    editingCardTitle = $bindable(''),
    addingCardToList = $bindable(null),
    newCardTitle = $bindable(''),
    datePickerCardId = $bindable(null),
    quickEditCardId = $bindable(null),
    ontogglecollapse,
    onarchivelist,
    onsortlist,
    onsetcardlimit,
    oncopylist,
    onmovelisttoboard,
    onsavelistname,
    onsavecardtitle,
    onsubmitnewcard,
    oncardclick,
    ontogglecardcompleted,
    onarchivecard,
    onsetcardduedate,
    onquicksavetitle,
    ontogglecardlabel,
    oncardconsider,
    oncardfinalize,
  }: Props = $props();

  function startEditList() {
    editingListId = list.id;
    editingListName = list.name;
  }

  let sortMenuOpen = $state(false);
  let limitInput = $state('');

  const SORT_OPTIONS = [
    { label: 'Name (A–Z)', by: 'name', direction: 'asc' },
    { label: 'Due date', by: 'dueDate', direction: 'asc' },
    { label: 'Newest first', by: 'createdAt', direction: 'desc' },
    { label: 'Oldest first', by: 'createdAt', direction: 'asc' },
  ] as const;

  function toggleSortMenu() {
    sortMenuOpen = !sortMenuOpen;
    if (sortMenuOpen) limitInput = list.cardLimit != null ? String(list.cardLimit) : '';
  }

  function pickSort(by: 'name' | 'dueDate' | 'createdAt', direction: 'asc' | 'desc') {
    sortMenuOpen = false;
    onsortlist(by, direction);
  }

  function applyCardLimit(e: Event) {
    e.preventDefault();
    const parsed = parseInt(limitInput, 10);
    if (Number.isNaN(parsed) || parsed < 1) return;
    sortMenuOpen = false;
    onsetcardlimit(Math.min(parsed, 999));
  }

  function clearCardLimit() {
    sortMenuOpen = false;
    onsetcardlimit(null);
  }

  let moveBoardTarget = $state('');

  function copyList() {
    sortMenuOpen = false;
    oncopylist();
  }

  function moveToBoard(e: Event) {
    e.preventDefault();
    if (!moveBoardTarget) return;
    sortMenuOpen = false;
    onmovelisttoboard(moveBoardTarget);
    moveBoardTarget = '';
  }

  let overLimit = $derived(list.cardLimit != null && list.cards.length > list.cardLimit);

  function cardLabels(card: CardWithProgress): Label[] {
    if (card.labelIds.length === 0) return [];
    return boardLabels.filter((l) => card.labelIds.includes(l.id));
  }
</script>

{#if collapsed}
  <div
    class="list-collapsed"
    class:list-collapsed-done={list.isDone}
    onclick={ontogglecollapse}
    onkeydown={(e) => { if (e.key === 'Enter') ontogglecollapse(); }}
    tabindex="0"
    role="button"
    aria-label="Expand list {list.name}"
  >
    {#if list.isDone}
      <span class="done-check-collapsed">✓</span>
    {/if}
    <span class="list-collapsed-name">{list.name}</span>
    {#if list.cards.length > 0}
      <span class="list-collapsed-count" class:wip-over={list.cardLimit != null && list.cards.length > list.cardLimit}>{list.cards.length}</span>
    {/if}
  </div>
{:else}
  <div class="list-column" class:list-column-done={list.isDone}>
    <div class="list-header">
      {#if editingListId === list.id}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="list-name-input"
          bind:value={editingListName}
          onblur={onsavelistname}
          onkeydown={(e) => e.key === 'Enter' && onsavelistname()}
          autofocus
        />
      {:else}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <h2
          class="list-name"
          ondblclick={startEditList}
          onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); startEditList(); } }}
          tabindex="0"
        >
          {#if list.isDone}
            <span class="done-check">✓</span>
          {/if}
          {list.name}
        </h2>
      {/if}
      {#if list.cardLimit != null}
        <span
          class="wip-badge"
          class:wip-over={overLimit}
          title={overLimit ? 'Card limit exceeded' : 'Card limit'}
        >{list.cards.length}/{list.cardLimit}</span>
      {/if}
      <button
        class="list-sort-btn"
        onclick={toggleSortMenu}
        aria-label="List options for {list.name}"
        aria-expanded={sortMenuOpen}
      >
        <svg viewBox="0 0 14 14" width="12" height="12"
          fill="none" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 2v10M4 12L2 9.5M4 12l2-2.5"/>
          <path d="M10 12V2M10 2L8 4.5M10 2l2 2.5"/>
        </svg>
      </button>
      {#if sortMenuOpen}
        <button
          class="sort-menu-backdrop"
          onclick={() => { sortMenuOpen = false; }}
          aria-label="Close sort menu"
        ></button>
        <div class="sort-menu" role="menu">
          <span class="sort-menu-title">Sort by</span>
          {#each SORT_OPTIONS as option (option.label)}
            <button
              class="sort-menu-item"
              role="menuitem"
              onclick={() => pickSort(option.by, option.direction)}
            >
              {option.label}
            </button>
          {/each}
          <div class="sort-menu-divider"></div>
          <span class="sort-menu-title">Card limit</span>
          <form class="wip-limit-row" onsubmit={applyCardLimit}>
            <input
              type="number"
              min="1"
              max="999"
              placeholder="None"
              bind:value={limitInput}
              aria-label="Card limit for {list.name}"
            />
            <button type="submit" class="wip-limit-set">Set</button>
            {#if list.cardLimit != null}
              <button type="button" class="wip-limit-clear" onclick={clearCardLimit}>Clear</button>
            {/if}
          </form>
          <div class="sort-menu-divider"></div>
          <button class="sort-menu-item" role="menuitem" onclick={copyList}>
            Copy list
          </button>
          {#if otherBoards.length > 0}
            <span class="sort-menu-title">Move to board</span>
            <form class="wip-limit-row" onsubmit={moveToBoard}>
              <select bind:value={moveBoardTarget} aria-label="Move list {list.name} to board">
                <option value="" disabled>Choose…</option>
                {#each otherBoards as board (board.id)}
                  <option value={board.id}>{board.name}</option>
                {/each}
              </select>
              <button type="submit" class="wip-limit-set" disabled={!moveBoardTarget}>Move</button>
            </form>
          {/if}
        </div>
      {/if}
      <button class="list-collapse-btn" onclick={ontogglecollapse} aria-label="Collapse list">
        <svg viewBox="0 0 14 14" width="12" height="12"
          fill="none" stroke="currentColor" stroke-width="1.5"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 3L5 7l4 4"/>
        </svg>
      </button>
      <button class="list-archive" onclick={onarchivelist} aria-label="Archive list">
        <svg viewBox="0 0 14 14" width="12" height="12"
          fill="none" stroke="currentColor" stroke-width="1.2"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 3.5V2.5a2 2 0 014 0v1"/>
          <line x1="1" y1="3.5" x2="13" y2="3.5"/>
          <path d="M2.5 3.5L3 12.5h8l.5-9"/>
          <line x1="5.5" y1="3.5" x2="5.2" y2="12.5"/>
          <line x1="7" y1="3.5" x2="7" y2="12.5"/>
          <line x1="8.5" y1="3.5" x2="8.8" y2="12.5"/>
        </svg>
      </button>
    </div>

    <div
      class="card-list"
      use:dndzone={{ items: list.cards, type: 'card', flipDurationMs, dropTargetStyle: {} }}
      onconsider={oncardconsider}
      onfinalize={oncardfinalize}
    >
      {#each list.cards as card (card.id)}
        <BoardCard
          {card}
          labels={cardLabels(card)}
          {boardLabels}
          dimmed={isCardDimmed(card)}
          isDone={list.isDone}
          agingDays={cardAgingDays}
          bind:editingCardId
          bind:editingCardTitle
          bind:datePickerCardId
          bind:quickEditCardId
          oncardclick={() => oncardclick(card)}
          ontogglecompleted={(completed) => ontogglecardcompleted(card.id, completed)}
          onarchive={() => onarchivecard(card.id)}
          onsavetitle={onsavecardtitle}
          onsetduedate={(date) => onsetcardduedate(card.id, date)}
          onquicksavetitle={(title) => onquicksavetitle(card.id, title)}
          ontogglelabel={(labelId, assign) => ontogglecardlabel(card.id, labelId, assign)}
        />
      {/each}
    </div>

    {#if addingCardToList === list.id}
      <form class="add-card-form" onsubmit={onsubmitnewcard}>
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
{/if}

<style>
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

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 8px;
    position: relative;
  }

  .sort-menu-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    border: none;
    cursor: default;
    z-index: 10;
  }

  .sort-menu {
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 11;
    background: white;
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    padding: 4px 0;
    min-width: 140px;
    display: flex;
    flex-direction: column;
  }

  .sort-menu-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-subtle);
    padding: 4px 12px;
  }

  .sort-menu-item {
    background: none;
    border: none;
    text-align: left;
    padding: 6px 12px;
    font-size: 13px;
    color: var(--color-text);
    cursor: pointer;
  }

  .sort-menu-item:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .sort-menu-divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 0;
  }

  .wip-limit-row {
    display: flex;
    gap: 4px;
    padding: 4px 12px 8px;
    align-items: center;
  }

  .wip-limit-row input {
    width: 56px;
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 13px;
  }

  .wip-limit-row select {
    flex: 1;
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 13px;
    background: white;
  }

  .wip-limit-set:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .wip-limit-set,
  .wip-limit-clear {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    color: var(--color-text);
  }

  .wip-limit-set:hover,
  .wip-limit-clear:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .wip-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-subtle);
    background: rgba(0, 0, 0, 0.08);
    border-radius: 10px;
    padding: 2px 7px;
    margin: 0 4px;
    white-space: nowrap;
  }

  .wip-badge.wip-over {
    background: #eb5a46;
    color: white;
  }

  .list-collapsed-count.wip-over {
    background: #eb5a46;
    color: white;
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

  .list-collapse-btn,
  .list-sort-btn,
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

  .list-header:hover .list-collapse-btn,
  .list-header:hover .list-sort-btn,
  .list-header:hover .list-archive,
  .list-sort-btn[aria-expanded='true'] {
    opacity: 1;
  }

  .list-collapse-btn:hover,
  .list-sort-btn:hover,
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

  .add-card-actions {
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

  .list-column-done {
    margin-left: auto;
  }

  .list-collapsed-done {
    margin-left: auto;
  }

  .done-check {
    color: #22c55e;
    font-weight: 700;
    margin-right: 4px;
  }

  .done-check-collapsed {
    color: #22c55e;
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 4px;
  }
</style>
