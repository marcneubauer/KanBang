<script lang="ts">
  import { api } from '$lib/api';
  import { LABEL_COLORS, type Label } from '@kanbang/shared';

  interface Props {
    cardId: string;
    boardId: string;
    labels: Label[];
    labelIds: string[];
    defaultLabelColor?: string;
    onchanged: () => void;
  }

  let { cardId, boardId, labels, labelIds, defaultLabelColor, onchanged }: Props = $props();

  // New labels default to the board's accent color when it's in the palette
  const initialColor =
    defaultLabelColor && (LABEL_COLORS as readonly string[]).includes(defaultLabelColor)
      ? defaultLabelColor
      : LABEL_COLORS[0];

  // null = closed, 'new' = creating, otherwise the label id being edited
  let editorTarget = $state<string | null>(null);
  let editorName = $state('');
  let editorColor = $state<string>(initialColor);

  function openCreate() {
    editorTarget = 'new';
    editorName = '';
    editorColor = initialColor;
  }

  function openEdit(label: Label) {
    editorTarget = label.id;
    editorName = label.name;
    editorColor = label.color;
  }

  async function toggleLabel(labelId: string) {
    const assigned = labelIds.includes(labelId);
    await api(`/cards/${cardId}/labels/${labelId}`, {
      method: assigned ? 'DELETE' : 'POST',
    });
    onchanged();
  }

  async function saveEditor(e: Event) {
    e.preventDefault();
    if (editorTarget === 'new') {
      const { label } = await api<{ label: Label }>(`/boards/${boardId}/labels`, {
        method: 'POST',
        body: JSON.stringify({ name: editorName.trim(), color: editorColor }),
      });
      // Assign new labels to the card immediately
      await api(`/cards/${cardId}/labels/${label.id}`, { method: 'POST' });
    } else if (editorTarget) {
      await api(`/labels/${editorTarget}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editorName.trim(), color: editorColor }),
      });
    }
    editorTarget = null;
    onchanged();
  }

  async function deleteLabel() {
    if (!editorTarget || editorTarget === 'new') return;
    if (!confirm('Delete this label from the board? It will be removed from all cards.')) return;
    await api(`/labels/${editorTarget}`, { method: 'DELETE' });
    editorTarget = null;
    onchanged();
  }
</script>

<div class="labels-section">
  <h3 class="section-label">Labels</h3>
  <div class="label-rows">
    {#each labels as label (label.id)}
      <div class="label-row">
        <button
          class="label-toggle"
          style="background: {label.color}"
          onclick={() => toggleLabel(label.id)}
          aria-pressed={labelIds.includes(label.id)}
        >
          <span class="label-toggle-name">{label.name}</span>
          {#if labelIds.includes(label.id)}
            <span class="label-toggle-check">✓</span>
          {/if}
        </button>
        <button class="label-edit-btn" onclick={() => openEdit(label)} aria-label="Edit label {label.name}">
          ✎
        </button>
      </div>
    {/each}
  </div>

  {#if editorTarget !== null}
    <form class="label-editor" onsubmit={saveEditor}>
      <input
        class="label-name-input"
        bind:value={editorName}
        placeholder="Label name (optional)"
        maxlength="50"
      />
      <div class="color-swatches">
        {#each LABEL_COLORS as color (color)}
          <button
            type="button"
            class="color-swatch"
            class:color-swatch-selected={editorColor === color}
            style="background: {color}"
            onclick={() => { editorColor = color; }}
            aria-label="Color {color}"
          ></button>
        {/each}
      </div>
      <div class="label-editor-actions">
        <button type="submit" class="btn-primary-sm">
          {editorTarget === 'new' ? 'Create' : 'Save'}
        </button>
        {#if editorTarget !== 'new'}
          <button type="button" class="btn-danger-sm" onclick={deleteLabel}>Delete</button>
        {/if}
        <button type="button" class="btn-close" onclick={() => { editorTarget = null; }}>&times;</button>
      </div>
    </form>
  {:else}
    <button class="add-label-btn" onclick={openCreate}>+ Create a new label</button>
  {/if}
</div>

<style>
  .labels-section {
    margin-bottom: 8px;
  }

  .section-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-subtle);
    margin-bottom: 8px;
  }

  .label-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  .label-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .label-toggle {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: none;
    border-radius: 3px;
    padding: 6px 10px;
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.35);
    min-height: 28px;
  }

  .label-toggle:hover {
    filter: brightness(0.92);
  }

  .label-edit-btn {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 4px 6px;
    border-radius: var(--radius-sm);
    font-size: 13px;
  }

  .label-edit-btn:hover {
    background: rgba(0, 0, 0, 0.08);
    color: var(--color-text);
  }

  .add-label-btn {
    width: 100%;
    padding: 6px 10px;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-subtle);
    cursor: pointer;
    text-align: left;
    font-size: 13px;
  }

  .add-label-btn:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .label-editor {
    background: rgba(0, 0, 0, 0.03);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 8px;
  }

  .label-name-input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 13px;
    margin-bottom: 8px;
  }

  .label-name-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .color-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }

  .color-swatch {
    width: 32px;
    height: 20px;
    border: 2px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    padding: 0;
  }

  .color-swatch-selected {
    border-color: var(--color-text);
  }

  .label-editor-actions {
    display: flex;
    align-items: center;
    gap: 4px;
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

  .btn-danger-sm {
    padding: 6px 12px;
    background: none;
    color: var(--color-danger);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-sm);
    font-size: 13px;
    cursor: pointer;
  }

  .btn-danger-sm:hover {
    background: #fdf2f2;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 18px;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 0 6px;
    margin-left: auto;
  }
</style>
