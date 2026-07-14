import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toastStore } from './toastStore.svelte';

beforeEach(() => {
  vi.useFakeTimers();
  for (const toast of [...toastStore.toasts]) toastStore.dismiss(toast.id);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toastStore', () => {
  it('shows and auto-dismisses after the default duration', () => {
    toastStore.show('Card archived');
    expect(toastStore.toasts).toHaveLength(1);
    expect(toastStore.toasts[0].message).toBe('Card archived');

    vi.advanceTimersByTime(6000);
    expect(toastStore.toasts).toHaveLength(0);
  });

  it('respects a custom duration', () => {
    toastStore.show('Quick toast', { durationMs: 1000 });
    vi.advanceTimersByTime(999);
    expect(toastStore.toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toastStore.toasts).toHaveLength(0);
  });

  it('dismisses manually and cancels the timer', () => {
    const id = toastStore.show('Dismiss me');
    toastStore.dismiss(id);
    expect(toastStore.toasts).toHaveLength(0);
    vi.advanceTimersByTime(10000);
    expect(toastStore.toasts).toHaveLength(0);
  });

  it('runs the action and dismisses the toast', async () => {
    const action = vi.fn();
    const id = toastStore.show('Card archived', { actionLabel: 'Undo', action });

    await toastStore.runAction(id);
    expect(action).toHaveBeenCalledTimes(1);
    expect(toastStore.toasts).toHaveLength(0);
  });

  it('stacks multiple toasts', () => {
    toastStore.show('One');
    toastStore.show('Two');
    expect(toastStore.toasts.map((t) => t.message)).toEqual(['One', 'Two']);
  });
});
