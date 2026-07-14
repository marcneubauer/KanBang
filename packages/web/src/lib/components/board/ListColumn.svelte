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
    filterLabelIds?: ReadonlySet<string>;
    editingListId?: string | null;
    editingListName?: string;
    editingCardId?: string | null;
    editingCardTitle?: string;
    addingCardToList?: string | null;
    newCardTitle?: string;
    datePickerCardId?: string | null;
    ontogglecollapse: () => void;
    onarchivelist: () => void;
    onsavelistname: () => void;
    onsavecardtitle: () => void;
    onsubmitnewcard: (e: Event) => void;
    oncardclick: (card: CardWithProgress) => void;
    ontogglecardcompleted: (cardId: string, completed: boolean) => void;
    onarchivecard: (cardId: string) => void;
    onsetcardduedate: (cardId: string, date: string | null) => void;
    oncardconsider: (e: CardDndEvent) => void;
    oncardfinalize: (e: CardDndEvent) => void;
  }

  let {
    list,
    collapsed,
    flipDurationMs,
    boardLabels = [],
    filterLabelIds = new Set<string>(),
    editingListId = $bindable(null),
    editingListName = $bindable(''),
    editingCardId = $bindable(null),
    editingCardTitle = $bindable(''),
    addingCardToList = $bindable(null),
    newCardTitle = $bindable(''),
    datePickerCardId = $bindable(null),
    ontogglecollapse,
    onarchivelist,
    onsavelistname,
    onsavecardtitle,
    onsubmitnewcard,
    oncardclick,
    ontogglecardcompleted,
    onarchivecard,
    onsetcardduedate,
    oncardconsider,
    oncardfinalize,
  }: Props = $props();

  function startEditList() {
    editingListId = list.id;
    editingListName = list.name;
  }

  function cardLabels(card: CardWithProgress): Label[] {
    if (card.labelIds.length === 0) return [];
    return boardLabels.filter((l) => card.labelIds.includes(l.id));
  }

  function isDimmed(card: CardWithProgress): boolean {
    if (filterLabelIds.size === 0) return false;
    return !card.labelIds.some((id) => filterLabelIds.has(id));
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
      <span class="list-collapsed-count">{list.cards.length}</span>
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
          dimmed={isDimmed(card)}
          isDone={list.isDone}
          bind:editingCardId
          bind:editingCardTitle
          bind:datePickerCardId
          oncardclick={() => oncardclick(card)}
          ontogglecompleted={(completed) => ontogglecardcompleted(card.id, completed)}
          onarchive={() => onarchivecard(card.id)}
          onsavetitle={onsavecardtitle}
          onsetduedate={(date) => onsetcardduedate(card.id, date)}
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
  .list-header:hover .list-archive {
    opacity: 1;
  }

  .list-collapse-btn:hover,
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
