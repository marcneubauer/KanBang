<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { BACKGROUND_GRADIENT_PRESETS, type BackgroundType } from '@kanbang/shared';

  interface DoneListOption {
    id: string;
    name: string;
    isDone: boolean;
  }

  let { boardId, boardName: initialBoardName, cardAgingDays, coversEnabled: initialCoversEnabled, background, lists, onclose, onupdated }: {
    boardId: string;
    boardName: string;
    cardAgingDays: number | null;
    coversEnabled: boolean;
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
  let coversEnabled = $state(initialCoversEnabled);

  async function toggleCovers(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    coversEnabled = checked;
    await api(`/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ coversEnabled: checked }),
    });
    onupdated();
  }

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
  let backgroundTab = $state<'color' | 'gradient' | 'image'>(
    background.type === 'color' ? 'color' : background.type === 'image' ? 'image' : 'gradient',
  );
  let currentBackground = $state(background);
  let colorValue = $state(background.type === 'color' && background.value ? background.value : '#0079bf');

  async function setBackground(type: 'color' | 'gradient' | null, value: string | null) {
    currentBackground = { type, value };
    await api(`/boards/${boardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ backgroundType: type, backgroundValue: value }),
    });
    onupdated();
  }

  let uploadingBackground = $state(false);
  let backgroundError = $state<string | null>(null);
  let backgroundFileInput = $state<HTMLInputElement | undefined>();

  async function uploadBackground(file: File) {
    backgroundError = null;
    uploadingBackground = true;
    try {
      const form = new FormData();
      form.append('file', file);
      const { board } = await api<{ board: { backgroundValue: string | null } }>(
        `/boards/${boardId}/background`,
        { method: 'POST', body: form },
      );
      currentBackground = { type: 'image', value: board.backgroundValue };
      onupdated();
    } catch (err) {
      backgroundError = err instanceof Error ? err.message : 'Upload failed';
    } finally {
      uploadingBackground = false;
    }
  }

  async function removeBackground() {
    // DELETE also unlinks an image background's stored file
    await api(`/boards/${boardId}/background`, { method: 'DELETE' });
    currentBackground = { type: null, value: null };
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
        <button
          class="bg-tab"
          class:bg-tab-active={backgroundTab === 'image'}
          role="tab"
          aria-selected={backgroundTab === 'image'}
          onclick={() => { backgroundTab = 'image'; }}
        >Image</button>
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
      {:else if backgroundTab === 'color'}
        <div class="color-row">
          <input
            type="color"
            bind:value={colorValue}
            onchange={() => setBackground('color', colorValue)}
            aria-label="Board background color"
          />
          <span class="color-value">{currentBackground.type === 'color' ? currentBackground.value : 'No color set'}</span>
        </div>
      {:else}
        <div class="bg-image-panel">
          {#if currentBackground.type === 'image' && currentBackground.value}
            <div
              class="bg-image-preview"
              style="background-image: url(/api/v1/files/{currentBackground.value})"
            ></div>
          {/if}
          <input
            bind:this={backgroundFileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            hidden
            onchange={(e) => {
              const input = e.target as HTMLInputElement;
              const file = input.files?.[0];
              if (file) {
                void uploadBackground(file);
                input.value = '';
              }
            }}
          />
          <button
            class="bg-upload-btn"
            onclick={() => backgroundFileInput?.click()}
            disabled={uploadingBackground}
          >
            {uploadingBackground
              ? 'Uploading…'
              : currentBackground.type === 'image'
                ? 'Replace image'
                : 'Upload image'}
          </button>
          {#if backgroundError}
            <p class="bg-error">{backgroundError}</p>
          {/if}
        </div>
      {/if}

      {#if currentBackground.type != null}
        <button class="bg-reset" onclick={removeBackground}>
          Remove background
        </button>
      {/if}
    </div>

    <!-- Card covers section -->
    <div class="modal-section">
      <h3 class="section-label">Card covers</h3>
      <label class="covers-toggle">
        <input type="checkbox" checked={coversEnabled} onchange={toggleCovers} />
        Show card covers on the board
      </label>
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
    background: var(--color-overlay);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 60px;
    z-index: 100;
    overflow-y: auto;
  }

  .modal {
    background: var(--color-surface-raised);
    border-radius: 8px;
    width: 100%;
    max-width: 480px;
    padding: 24px;
    position: relative;
    margin-bottom: 60px;
  }

  .covers-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-text);
    cursor: pointer;
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
    background: var(--color-hover);
  }

  .bg-image-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .bg-image-preview {
    width: 100%;
    height: 90px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background-size: cover;
    background-position: center;
  }

  .bg-upload-btn {
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .bg-upload-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .bg-upload-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .bg-error {
    font-size: 12px;
    color: var(--color-danger);
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
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
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
