<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { BACKGROUND_GRADIENT_PRESETS, type BackgroundType } from '@kanbang/shared';

  interface DoneListOption {
    id: string;
    name: string;
    isDone: boolean;
  }

  let { boardId, boardName: initialBoardName, cardAgingDays, background, lists, onclose, onupdated }: {
    boardId: string;
    boardName: string;
    cardAgingDays: number | null;
    background: { type: BackgroundType | null; value: string | null };
    lists: DoneListOption[];
    onclose: () => void;
    onupdated: () => void;
  } = $props();

  let boardName = $state(initialBoardName);
  let confirmingArchive = $state(false);

  let currentDoneListId = $derived(lists.find((l) => l.isDone)?.id ?? '');
  let selectedDoneListId = $state(lists.find((l) => l.isDone)?.id ?? '');

  async function handleDoneListChange(e: Event) {
    const newId = (e.target as HTMLSelectElement).value;
    const previousId = currentDoneListId;

    // If clearing the done list
    if (!newId && previousId) {
      await api(`/lists/${previousId}/done`, {
        method: 'PATCH',
        body: JSON.stringify({ isDone: false }),
      });
    }
    // If setting a new done list
    else if (newId) {
      await api(`/lists/${newId}/done`, {
        method: 'PATCH',
        body: JSON.stringify({ isDone: true }),
      });
    }

    selectedDoneListId = newId;
    onupdated();
  }

  async function saveBoardName() {
    const trimmed = boardName.trim();
    if (!trimmed || trimmed === initialBoardName) return;
    await api(`/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: trimmed }),
    });
    onupdated();
  }

  let selectedAgingDays = $state(cardAgingDays != null ? String(cardAgingDays) : '');

  async function handleAgingChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    selectedAgingDays = value;
    await api(`/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ cardAgingDays: value ? parseInt(value, 10) : null }),
    });
    onupdated();
  }

  // --- Background picker ---
  let backgroundTab = $state<'color' | 'gradient'>(background.type === 'color' ? 'color' : 'gradient');
  let currentBackground = $state(background);
  let colorValue = $state(background.type === 'color' && background.value ? background.value : '#0079bf');

  async function setBackground(type: BackgroundType | null, value: string | null) {
    currentBackground = { type, value };
    await api(`/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ backgroundType: type, backgroundValue: value }),
    });
    onupdated();
  }

  async function archiveBoard() {
    await api(`/boards/${boardId}/archive`, { method: 'PATCH' });
    goto('/boards');
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
  <div class="modal" role="dialog" aria-modal="true">
    <button class="modal-close" onclick={onclose} aria-label="Close">&times;</button>

    <h2 class="modal-title">Board Settings</h2>

    <!-- General section -->
    <div class="modal-section">
      <h3 class="section-label">General</h3>

      <label class="field-label" for="board-name-input">Board name</label>
      <input
        id="board-name-input"
        class="field-input"
        bind:value={boardName}
        onblur={saveBoardName}
        onkeydown={(e) => e.key === 'Enter' && saveBoardName()}
      />
    </div>

    <!-- Done list section -->
    <div class="modal-section">
      <h3 class="section-label">Done list</h3>

      <label class="field-label" for="done-list-select">
        Cards marked complete will auto-move to this list
      </label>
      <select
        id="done-list-select"
        class="field-input"
        value={selectedDoneListId}
        onchange={handleDoneListChange}
      >
        <option value="">None</option>
        {#each lists as list (list.id)}
          <option value={list.id}>{list.name}</option>
        {/each}
      </select>
    </div>

    <!-- Background section -->
    <div class="modal-section">
      <h3 class="section-label">Background</h3>

      <div class="bg-tabs" role="tablist">
        <button
          class="bg-tab"
          class:bg-tab-active={backgroundTab === 'gradient'}
          role="tab"
          aria-selected={backgroundTab === 'gradient'}
          onclick={() => { backgroundTab = 'gradient'; }}
        >Gradient</button>
        <button
          class="bg-tab"
          class:bg-tab-active={backgroundTab === 'color'}
          role="tab"
          aria-selected={backgroundTab === 'color'}
          onclick={() => { backgroundTab = 'color'; }}
        >Color</button>
      </div>

      {#if backgroundTab === 'gradient'}
        <div class="gradient-grid">
          {#each BACKGROUND_GRADIENT_PRESETS as preset (preset.id)}
            <button
              class="gradient-swatch"
              style="background: {preset.css}"
              title={preset.name}
              aria-label="Gradient {preset.name}"
              aria-pressed={currentBackground.type === 'gradient' && currentBackground.value === preset.id}
              onclick={() => setBackground('gradient', preset.id)}
            >
              {#if currentBackground.type === 'gradient' && currentBackground.value === preset.id}
                <span class="swatch-check">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="color-row">
          <input
            type="color"
            bind:value={colorValue}
            onchange={() => setBackground('color', colorValue)}
            aria-label="Board background color"
          />
          <span class="color-value">{currentBackground.type === 'color' ? currentBackground.value : 'No color set'}</span>
        </div>
      {/if}

      {#if currentBackground.type != null}
        <button class="bg-reset" onclick={() => setBackground(null, null)}>
          Remove background
        </button>
      {/if}
    </div>

    <!-- Card aging section -->
    <div class="modal-section">
      <h3 class="section-label">Card aging</h3>

      <label class="field-label" for="card-aging-select">
        Fade cards that haven't been touched for a while
      </label>
      <select
        id="card-aging-select"
        class="field-input"
        value={selectedAgingDays}
        onchange={handleAgingChange}
      >
        <option value="">Off</option>
        <option value="7">After 1 week</option>
        <option value="14">After 2 weeks</option>
        <option value="30">After 1 month</option>
        <option value="90">After 3 months</option>
      </select>
    </div>

    <!-- Danger zone -->
    <div class="modal-section">
      <h3 class="section-label section-label-danger">Danger zone</h3>
      {#if confirmingArchive}
        <p class="confirm-text">Are you sure? This will archive the board and all its contents.</p>
        <div class="confirm-actions">
          <button class="btn-danger" onclick={archiveBoard}>Yes, archive board</button>
          <button class="btn-cancel-text" onclick={() => { confirmingArchive = false; }}>Cancel</button>
        </div>
      {:else}
        <button class="btn-danger-outline" onclick={() => { confirmingArchive = true; }}>
          Archive this board
        </button>
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
    max-width: 480px;
    padding: 24px;
    position: relative;
    margin-bottom: 60px;
  }

  .bg-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 10px;
  }

  .bg-tab {
    padding: 5px 12px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
    color: var(--color-text);
  }

  .bg-tab-active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .gradient-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .gradient-swatch {
    height: 48px;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gradient-swatch:hover {
    filter: brightness(1.08);
  }

  .swatch-check {
    color: white;
    font-weight: 700;
    font-size: 16px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .color-row input[type='color'] {
    width: 56px;
    height: 40px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .color-value {
    font-size: 13px;
    color: var(--color-text-subtle);
    font-family: monospace;
  }

  .bg-reset {
    margin-top: 10px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 5px 10px;
    font-size: 12px;
    color: var(--color-text-subtle);
    cursor: pointer;
  }

  .bg-reset:hover {
    color: var(--color-text);
    background: rgba(0, 0, 0, 0.04);
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

  .modal-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 20px;
    padding-right: 32px;
  }

  .modal-section {
    margin-bottom: 24px;
  }

  .section-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-subtle);
    margin: 0 0 12px;
  }

  .section-label-danger {
    color: var(--color-danger);
  }

  .field-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    margin-bottom: 4px;
  }

  .field-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: inherit;
  }

  .field-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(0, 121, 191, 0.2);
  }

  .btn-danger-outline {
    padding: 8px 16px;
    background: none;
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
  }

  .btn-danger-outline:hover {
    background: var(--color-danger);
    color: white;
  }

  .confirm-text {
    font-size: 13px;
    color: var(--color-text);
    margin: 0 0 8px;
  }

  .confirm-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-danger {
    padding: 8px 16px;
    background: var(--color-danger);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
  }

  .btn-danger:hover {
    opacity: 0.9;
  }

  .btn-cancel-text {
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--color-text-subtle);
    font-size: 13px;
    cursor: pointer;
  }

  .btn-cancel-text:hover {
    color: var(--color-text);
  }
</style>
