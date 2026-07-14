<script lang="ts">
  import type { CardWithProgress, Label } from '@kanbang/shared';

  interface Props {
    card: CardWithProgress;
    boardLabels: Label[];
    onsavetitle: (title: string) => void;
    ontogglelabel: (labelId: string, assign: boolean) => void;
    onsetduedate: (date: string | null) => void;
    onclose: () => void;
  }

  let { card, boardLabels, onsavetitle, ontogglelabel, onsetduedate, onclose }: Props = $props();

  let title = $state(card.title);

  function toInputValue(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toISOString().slice(0, 10);
  }

  let dateValue = $state(toInputValue(card.dueDate));

  function save(e: Event) {
    e.preventDefault();
    if (title.trim() && title.trim() !== card.title) {
      onsavetitle(title.trim());
    }
    onclose();
  }

  function handleDateChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    onsetduedate(val ? new Date(val + 'T12:00:00Z').toISOString() : null);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="quick-edit-backdrop" onclick={onclose} onkeydown={handleKeydown}></div>
<div class="quick-edit" onkeydown={handleKeydown} role="dialog" aria-label="Quick edit card">
  <form onsubmit={save}>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea class="quick-edit-title" bind:value={title} rows="2" autofocus></textarea>

    {#if boardLabels.length > 0}
      <div class="quick-edit-labels">
        {#each boardLabels as label (label.id)}
          {@const assigned = card.labelIds.includes(label.id)}
          <button
            type="button"
            class="quick-edit-label"
            class:quick-edit-label-assigned={assigned}
            style="background: {label.color}"
            title={label.name || 'Unnamed label'}
            aria-pressed={assigned}
            onclick={() => ontogglelabel(label.id, !assigned)}
          >
            {label.name}{assigned ? ' ✓' : ''}
          </button>
        {/each}
      </div>
    {/if}

    <div class="quick-edit-due">
      <label>
        Due
        <input type="date" value={dateValue} onchange={handleDateChange} />
      </label>
      {#if card.dueDate}
        <button type="button" class="quick-edit-remove-due" onclick={() => onsetduedate(null)}>
          Remove
        </button>
      {/if}
    </div>

    <div class="quick-edit-actions">
      <button type="submit" class="btn-primary-sm">Save</button>
      <button type="button" class="btn-close" onclick={onclose}>&times;</button>
    </div>
  </form>
</div>

<style>
  .quick-edit-backdrop {
    position: fixed;
    inset: 0;
    z-index: 19;
    background: transparent;
  }

  .quick-edit {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 20;
    width: 256px;
    background: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    padding: 8px;
    cursor: default;
  }

  .quick-edit-title {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: inherit;
    resize: none;
    margin-bottom: 8px;
  }

  .quick-edit-title:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .quick-edit-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }

  .quick-edit-label {
    border: none;
    border-radius: 3px;
    padding: 3px 8px;
    min-width: 28px;
    min-height: 18px;
    font-size: 11px;
    font-weight: 600;
    color: white;
    cursor: pointer;
    opacity: 0.55;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.35);
  }

  .quick-edit-label:hover {
    opacity: 0.85;
  }

  .quick-edit-label-assigned {
    opacity: 1;
  }

  .quick-edit-due {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .quick-edit-due label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--color-text-subtle);
  }

  .quick-edit-due input[type='date'] {
    font-size: 13px;
    padding: 3px 6px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }

  .quick-edit-remove-due {
    font-size: 12px;
    padding: 3px 8px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--color-text-subtle);
  }

  .quick-edit-actions {
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
