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
    <div class="header-actions">
      <button class="btn-icon" onclick={toggleArchivedBoards} aria-label="Toggle archived boards">
        {#if showArchivedBoards}
          <svg viewBox="0 0 16 16" width="16" height="16"
            fill="none" stroke="currentColor" stroke-width="1.2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
            <circle cx="8" cy="8" r="2"/>
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" width="16" height="16"
            fill="none" stroke="currentColor" stroke-width="1.2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
            <circle cx="8" cy="8" r="2"/>
            <line x1="2" y1="14" x2="14" y2="2"/>
          </svg>
        {/if}
      </button>
      <button class="btn-primary" onclick={() => (showCreate = true)}>+ Create Board</button>
    </div>
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
      </a>
    {/each}

    {#if data.boards.length === 0 && !showCreate}
      <p class="empty">No boards yet. Create one to get started.</p>
    {/if}
  </div>

  {#if showArchivedBoards}
    <div class="archived-drawer">
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
    </div>
  {/if}
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-icon {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    border-radius: var(--radius-sm);
    transition: color 150ms;
  }

  .btn-icon:hover {
    color: var(--color-text);
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

  .empty {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--color-text-subtle);
    padding: 40px;
  }

  .archived-drawer {
    margin-top: 32px;
    border-top: 1px solid var(--color-border);
    padding-top: 16px;
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
    background: var(--color-surface);
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
    background: var(--color-surface);
    color: var(--color-text);
  }
</style>
