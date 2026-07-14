<script lang="ts">
  import { toastStore } from '$lib/toastStore.svelte';
</script>

{#if toastStore.toasts.length > 0}
  <div class="toaster" aria-live="polite">
    {#each toastStore.toasts as toast (toast.id)}
      <div class="toast" role="status">
        <span class="toast-message">{toast.message}</span>
        {#if toast.actionLabel && toast.action}
          <button class="toast-action" onclick={() => toastStore.runAction(toast.id)}>
            {toast.actionLabel}
          </button>
        {/if}
        <button class="toast-dismiss" onclick={() => toastStore.dismiss(toast.id)} aria-label="Dismiss">
          &times;
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toaster {
    position: fixed;
    bottom: 16px;
    left: 16px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #2b2f36;
    color: white;
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    padding: 10px 12px;
    font-size: 13px;
    max-width: 360px;
  }

  .toast-message {
    flex: 1;
  }

  .toast-action {
    background: none;
    border: none;
    color: #7db9ff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    white-space: nowrap;
  }

  .toast-action:hover {
    text-decoration: underline;
  }

  .toast-dismiss {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 16px;
    cursor: pointer;
    padding: 0 2px;
  }

  .toast-dismiss:hover {
    color: white;
  }
</style>
