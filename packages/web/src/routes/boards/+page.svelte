<script lang="ts">
  import { api } from '$lib/api';
  import { invalidateAll } from '$app/navigation';

  interface Board {
    id: string;
    name: string;
  }

  let { data } = $props();

  let showCreate = $state(false);
  let newBoardName = $state('');
  let creating = $state(false);

  let showArchivedBoards = $state(false);
  let archivedBoards = $state<Board[]>([]);
  let loadingArchivedBoards = $state(false);

  async function createBoard(e: Event) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    creating = true;
    try {
      await api('/boards', {
        method: 'POST',
        body: JSON.stringify({ name: newBoardName.trim() }),
      });
      newBoardName = '';
      showCreate = false;
      invalidateAll();
    } finally {
      creating = false;
    }
  }

  async function archiveBoard(id: string) {
    await api(`/boards/${id}/archive`, { method: 'PATCH' });
    invalidateAll();
  }

  async function toggleArchivedBoards() {
    if (!showArchivedBoards) {
      loadingArchivedBoards = true;
      try {
        const res = await api<{ boards: Board[] }>('/boards?archived=true');
        archivedBoards = res.boards;
      } finally {
        loadingArchivedBoards = false;
      }
    }
    showArchivedBoards = !showArchivedBoards;
  }

  async function unarchiveBoard(id: string) {
    await api(`/boards/${id}/unarchive`, { method: 'PATCH' });
    archivedBoards = archivedBoards.filter((b) => b.id !== id);
    invalidateAll();
  }
</script>

<div class="page">
  <header class="page-header">
    <h1>Your Boards</h1>
    <button class="btn-primary" onclick={() => (showCreate = true)}>+ Create Board</button>
  </header>

  {#if showCreate}
    <div class="create-form">
      <form onsubmit={createBoard}>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          bind:value={newBoardName}
          placeholder="Board name"
          maxlength="100"
          autofocus
        />
        <button type="submit" class="btn-primary" disabled={creating}>Create</button>
        <button type="button" class="btn-ghost" onclick={() => (showCreate = false)}>Cancel</button>
      </form>
    </div>
  {/if}

  <div class="board-grid">
    {#each data.boards as board (board.id)}
      <a href="/boards/{board.id}" class="board-card">
        <span class="board-name">{board.name}</span>
        <button
          class="board-archive"
          onclick={(e) => { e.stopPropagation(); e.preventDefault(); archiveBoard(board.id); }}
          aria-label="Archive board"
        >
          <svg viewBox="0 0 14 14" width="13" height="13" fill="currentColor">
            <rect x="0" y="0" width="14" height="3.5" rx="1"/>
            <rect x="1" y="4.5" width="12" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
            <path d="M5 8.5h4M7 7v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </button>
      </a>
    {/each}

    {#if data.boards.length === 0 && !showCreate}
      <p class="empty">No boards yet. Create one to get started.</p>
    {/if}
  </div>

  <div class="archived-section">
    <button class="archived-toggle" onclick={toggleArchivedBoards}>
      {showArchivedBoards ? '▾' : '▸'} Show archived boards
    </button>

    {#if showArchivedBoards}
      {#if loadingArchivedBoards}
        <p class="archived-loading">Loading…</p>
      {:else if archivedBoards.length === 0}
        <p class="archived-empty">No archived boards.</p>
      {:else}
        <div class="archived-board-grid">
          {#each archivedBoards as board (board.id)}
            <div class="archived-board-card">
              <span class="archived-board-name">{board.name}</span>
              <button class="btn-unarchive" onclick={() => unarchiveBoard(board.id)}>Unarchive</button>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 16px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  h1 {
    font-size: 20px;
  }

  .btn-primary {
    padding: 8px 16px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 14px;
    cursor: pointer;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-ghost {
    padding: 8px 16px;
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    font-size: 14px;
  }

  .create-form {
    margin-bottom: 24px;
  }

  .create-form form {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .create-form input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 14px;
  }

  .board-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .board-card {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius);
    text-decoration: none;
    min-height: 80px;
    transition: background 150ms;
  }

  .board-card:hover {
    background: var(--color-primary-hover);
    text-decoration: none;
  }

  .board-name {
    font-size: 16px;
    font-weight: 700;
  }

  .board-archive {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    padding: 2px;
    line-height: 1;
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 150ms;
  }

  .board-card:hover .board-archive {
    opacity: 1;
  }

  .board-archive:hover {
    color: white;
  }

  .empty {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--color-text-subtle);
    padding: 40px;
  }

  .archived-section {
    margin-top: 32px;
    border-top: 1px solid var(--color-border);
    padding-top: 16px;
  }

  .archived-toggle {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    font-size: 13px;
    cursor: pointer;
    padding: 0;
  }

  .archived-toggle:hover {
    color: var(--color-text);
  }

  .archived-loading,
  .archived-empty {
    font-size: 13px;
    color: var(--color-text-subtle);
    margin-top: 12px;
  }

  .archived-board-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 12px;
  }

  .archived-board-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--color-surface, #f5f5f5);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    opacity: 0.7;
  }

  .archived-board-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-subtle);
  }

  .btn-unarchive {
    padding: 4px 10px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    cursor: pointer;
    color: var(--color-text-subtle);
    white-space: nowrap;
  }

  .btn-unarchive:hover {
    background: var(--color-surface, #f0f0f0);
    color: var(--color-text);
  }
</style>
