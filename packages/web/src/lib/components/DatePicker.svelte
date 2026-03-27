<script lang="ts">
  let { value, onchange, onclose }: {
    value: string | null;
    onchange: (date: string | null) => void;
    onclose: () => void;
  } = $props();

  function toInputValue(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  }

  let inputValue = $state(toInputValue(value));

  function handleChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const val = target.value;
    if (val) {
      const isoString = new Date(val + 'T12:00:00Z').toISOString();
      onchange(isoString);
    }
    onclose();
  }

  function handleRemove() {
    onchange(null);
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="date-picker" onkeydown={handleKeydown}>
  <!-- svelte-ignore a11y_autofocus -->
  <input
    type="date"
    value={inputValue}
    onchange={handleChange}
    autofocus
  />
  <button class="remove-btn" onclick={handleRemove}>Remove due date</button>
</div>

<style>
  .date-picker {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 10;
    background: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 180px;
  }

  .date-picker input[type='date'] {
    font-size: 13px;
    padding: 4px 6px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .remove-btn {
    font-size: 12px;
    padding: 4px 8px;
    background: none;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    color: #666;
  }

  .remove-btn:hover {
    background: #f5f5f5;
    color: #333;
  }
</style>
