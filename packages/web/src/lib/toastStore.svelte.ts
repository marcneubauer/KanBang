import { SvelteMap } from 'svelte/reactivity';

export type Toast = {
  id: string;
  message: string;
  actionLabel?: string;
  action?: () => void | Promise<void>;
};

const DEFAULT_DURATION_MS = 6000;

function createStore() {
  let toasts = $state<Toast[]>([]);
  const timers = new SvelteMap<string, ReturnType<typeof setTimeout>>();

  function dismiss(id: string) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    toasts = toasts.filter((t) => t.id !== id);
  }

  return {
    get toasts() {
      return toasts;
    },
    show(
      message: string,
      opts: { actionLabel?: string; action?: Toast['action']; durationMs?: number } = {},
    ) {
      const toast: Toast = {
        id: crypto.randomUUID(),
        message,
        actionLabel: opts.actionLabel,
        action: opts.action,
      };
      toasts = [...toasts, toast];
      timers.set(
        toast.id,
        setTimeout(() => dismiss(toast.id), opts.durationMs ?? DEFAULT_DURATION_MS),
      );
      return toast.id;
    },
    dismiss,
    async runAction(id: string) {
      const toast = toasts.find((t) => t.id === id);
      dismiss(id);
      await toast?.action?.();
    },
  };
}

export const toastStore = createStore();
