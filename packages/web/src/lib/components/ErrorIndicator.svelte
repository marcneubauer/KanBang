<script lang="ts">
  import { errorStore } from '$lib/errorStore.svelte';

  let open = $state(false);

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString();
  }

  function handleBackdropClick() {
    open = false;
  }

  function toggleOpen() {
    open = !open;
  }

  function clearAll() {
    errorStore.clear();
    open = false;
  }
</script>

{#if errorStore.count > 0}
  <div class="error-indicator-wrapper">
    <button
      class="error-indicator"
      onclick={toggleOpen}
      aria-label={`${errorStore.count} errors`}
    >
      <span class="error-dot"></span>
      <span class="error-count">{errorStore.count}</span>
    </button>

    {#if open}
      <div
        class="error-backdrop"
        onclick={handleBackdropClick}
        role="presentation"
      ></div>
      <div class="error-panel" role="dialog" aria-label="Recent errors">
        <div class="error-panel-header">
          <span class="error-panel-title">Recent errors</span>
          <button class="error-clear" onclick={clearAll}>Clear all</button>
        </div>
        <ul class="error-list">
          {#each errorStore.entries as entry (entry.id)}
            <li class="error-entry">
              <div class="error-entry-head">
                <span class="error-time">{formatTime(entry.timestamp)}</span>
                <span class="error-status">
                  {entry.method}{entry.path ? ` ${entry.path}` : ''}{entry.status !==
                    null
                    ? ` — ${entry.status}`
                    : ''}
                </span>
              </div>
              <div class="error-message">{entry.code}: {entry.message}</div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}

<style>
  .error-indicator-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .error-indicator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: none;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.15);
    color: white;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
  }

  .error-indicator:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .error-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #dc2626;
    box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.25);
  }

  .error-count {
    font-weight: 600;
  }

  .error-backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 99;
  }

  .error-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 360px;
    max-height: 400px;
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    z-index: 100;
    overflow: hidden;
  }

  .error-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
  }

  .error-panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }

  .error-clear {
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 12px;
    cursor: pointer;
  }

  .error-clear:hover {
    background: var(--color-bg);
  }

  .error-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1 1 auto;
  }

  .error-entry {
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .error-entry:last-child {
    border-bottom: none;
  }

  .error-entry-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
      'Courier New', monospace;
    font-size: 12px;
    color: var(--color-text-subtle);
  }

  .error-time {
    flex: 0 0 auto;
  }

  .error-status {
    flex: 1 1 auto;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .error-message {
    margin-top: 4px;
    font-size: 13px;
    color: var(--color-text);
    word-break: break-word;
  }
</style>
