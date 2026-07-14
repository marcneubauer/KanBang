<script module lang="ts">
  export interface ArchivedListEntry {
    id: string;
    name: string;
    archivedAt: string;
    cards: { id: string }[];
  }

  export interface ArchivedCardEntry {
    id: string;
    title: string;
    listId: string;
    listName: string;
    position: string;
    completed: boolean;
    archivedAt: string;
  }

  export interface ArchivedItems {
    archivedLists: ArchivedListEntry[];
    archivedCards: ArchivedCardEntry[];
  }
</script>

<script lang="ts">
  import { api } from '$lib/api';

  interface Props {
    boardId: string;
    archivedItems?: ArchivedItems | null;
    onrestored: () => Promise<void>;
  }

  let { boardId, archivedItems = $bindable(null), onrestored }: Props = $props();

  let showArchived = $state(false);
  let loadingArchived = $state(false);

  async function toggleArchived() {
    if (!showArchived && !archivedItems) {
      loadingArchived = true;
      try {
        archivedItems = await api<ArchivedItems>(`/boards/${boardId}/archived`);
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
    await onrestored();
  }

  async function unarchiveCard(cardId: string) {
    await api(`/cards/${cardId}/unarchive`, { method: 'PATCH' });
    if (archivedItems) {
      archivedItems.archivedCards = archivedItems.archivedCards.filter((c) => c.id !== cardId);
    }
    await onrestored();
  }
</script>

<div class="archived-panel">
  <button class="archived-toggle" onclick={toggleArchived}>
    {showArchived ? '▾' : '▸'} Archived items
  </button>

  {#if showArchived}
    <div class="archived-content" aria-live="polite">
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

<style>
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
</style>
