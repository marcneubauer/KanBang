<script lang="ts">
  import { api } from '$lib/api';
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  let showCreate = $state(false);
  let newBoardName = $state('');
  let creating = $state(false);

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

  async function deleteBoard(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await api(`/boards/${id}`, { method: 'DELETE' });
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
          class="board-delete"
          onclick={(e) => { e.stopPropagation(); e.preventDefault(); deleteBoard(board.id, board.name); }}
          aria-label="Delete board"
        >&times;</button>
      </a>
    {/each}

    {#if data.boards.length === 0 && !showCreate}
      <p class="empty">No boards yet. Create one to get started.</p>
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

  .board-delete {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    opacity: 0;
    transition: opacity 150ms;
  }

  .board-card:hover .board-delete {
    opacity: 1;
  }

  .board-delete:hover {
    color: white;
  }

  .empty {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--color-text-subtle);
    padding: 40px;
  }
</style>
