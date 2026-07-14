<script lang="ts">
  import type { CardWithProgress } from '@kanbang/shared';
  import { getDueDateStatus, formatDueDate } from '$lib/utils/due-date';
  import DatePicker from '$lib/components/DatePicker.svelte';

  interface Props {
    card: CardWithProgress;
    isDone?: boolean;
    editingCardId?: string | null;
    editingCardTitle?: string;
    datePickerCardId?: string | null;
    oncardclick: () => void;
    ontogglecompleted: (completed: boolean) => void;
    onarchive: () => void;
    onsavetitle: () => void;
    onsetduedate: (date: string | null) => void;
  }

  let {
    card,
    isDone = false,
    editingCardId = $bindable(null),
    editingCardTitle = $bindable(''),
    datePickerCardId = $bindable(null),
    oncardclick,
    ontogglecompleted,
    onarchive,
    onsavetitle,
    onsetduedate,
  }: Props = $props();
</script>

<div class="card-item" class:card-item-done={isDone}>
  <button
    class="card-checkbox"
    class:card-checkbox-checked={card.completed}
    onclick={(e) => { e.stopPropagation(); ontogglecompleted(!card.completed); }}
    aria-label={card.completed ? 'Mark incomplete' : 'Mark complete'}
  >
    {#if card.completed}
      <svg viewBox="0 0 16 16" width="16" height="16">
        <rect width="16" height="16" rx="2" fill="#22c55e"/>
        <path d="M4 8l3 3 5-5" stroke="white" stroke-width="2"
        fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    {:else}
      <svg viewBox="0 0 16 16" width="16" height="16">
        <rect x="0.5" y="0.5" width="15" height="15" rx="1.5"
        fill="none" stroke="#b0b0b0" stroke-width="1"/>
      </svg>
    {/if}
  </button>
  {#if editingCardId === card.id}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="card-title-input"
      bind:value={editingCardTitle}
      onblur={onsavetitle}
      onkeydown={(e) => e.key === 'Enter' && onsavetitle()}
      autofocus
    />
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class="card-title"
      class:card-title-completed={isDone || card.completed}
      onclick={(e) => { e.stopPropagation(); oncardclick(); }}
      onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); oncardclick(); } }}
      tabindex="0"
    >
      {card.title}
    </span>
  {/if}
  {#if !isDone}
    <button
      class="card-due-date-btn"
      onclick={(e) => {
        e.stopPropagation();
        datePickerCardId = datePickerCardId === card.id ? null : card.id;
      }}
      aria-label="Set due date"
    >
      <svg viewBox="0 0 14 14" width="11" height="11"
        fill="none" stroke="currentColor" stroke-width="1.2"
        stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="2" width="12" height="11" rx="1"/>
        <line x1="1" y1="5.5" x2="13" y2="5.5"/>
        <line x1="4" y1="1" x2="4" y2="3"/>
        <line x1="10" y1="1" x2="10" y2="3"/>
      </svg>
    </button>
  {/if}
  <button
    class="card-archive"
    onclick={onarchive}
    aria-label="Archive card"
  >
    <svg viewBox="0 0 14 14" width="11" height="11"
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
  {#if card.dueDate}
    <span class="due-date-badge due-date-{getDueDateStatus(card.dueDate, card.completed)}">
      {formatDueDate(card.dueDate)}
    </span>
  {/if}
  {#if !isDone && datePickerCardId === card.id}
    <DatePicker
      value={card.dueDate}
      onchange={(date) => onsetduedate(date)}
      onclose={() => { datePickerCardId = null; }}
    />
  {/if}
  {#if card.checklistProgress && card.checklistProgress.total > 0}
    <span
      class="checklist-badge"
      class:checklist-badge-complete={card.checklistProgress.completed === card.checklistProgress.total}
    >
      <svg viewBox="0 0 16 16" width="12" height="12">
        <rect x="0.5" y="0.5" width="15" height="15" rx="1.5"
        fill="none" stroke="currentColor" stroke-width="1"/>
        <path d="M4 8l3 3 5-5" stroke="currentColor" stroke-width="1.5"
        fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {card.checklistProgress.completed}/{card.checklistProgress.total}
    </span>
  {/if}
</div>

<style>
  .card-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    position: relative;
    padding: 8px 8px;
    background: white;
    border-radius: var(--radius-sm);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    cursor: grab;
  }

  .card-item:active {
    cursor: grabbing;
  }

  .card-item-done {
    opacity: 0.6;
  }

  .card-title {
    font-size: 14px;
    flex: 1;
    cursor: pointer;
    word-break: break-word;
  }

  .card-title-input {
    font-size: 14px;
    border: 2px solid var(--color-primary);
    border-radius: var(--radius-sm);
    padding: 2px 4px;
    flex: 1;
    width: 100%;
  }

  .card-checkbox {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-right: 6px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 150ms;
    display: flex;
    align-items: center;
  }

  .card-checkbox-checked {
    opacity: 1;
  }

  .card-item:hover .card-checkbox {
    opacity: 1;
  }

  .card-title-completed {
    opacity: 0.6;
  }

  .card-archive {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 1px 2px;
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 150ms;
    flex-shrink: 0;
  }

  .card-item:hover .card-archive {
    opacity: 1;
  }

  .card-archive:hover {
    color: var(--color-text);
  }

  .card-due-date-btn {
    background: none;
    border: none;
    color: var(--color-text-subtle);
    cursor: pointer;
    padding: 1px 2px;
    display: flex;
    align-items: center;
    opacity: 0;
    transition: opacity 150ms;
    flex-shrink: 0;
  }

  .card-item:hover .card-due-date-btn {
    opacity: 1;
  }

  .card-due-date-btn:hover {
    color: var(--color-text);
  }

  .due-date-badge {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 3px;
    width: 100%;
    margin-top: 4px;
  }

  .due-date-neutral {
    background: #f0f0f0;
    color: #555;
  }

  .due-date-soon {
    background: #fef3c7;
    color: #92400e;
  }

  .due-date-overdue {
    background: #fee2e2;
    color: #991b1b;
  }

  .due-date-complete {
    background: #dcfce7;
    color: #166534;
  }

  .checklist-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 3px;
    background: #f0f0f0;
    color: #555;
    width: auto;
    margin-top: 4px;
  }

  .checklist-badge-complete {
    background: #dcfce7;
    color: #166534;
  }
</style>
