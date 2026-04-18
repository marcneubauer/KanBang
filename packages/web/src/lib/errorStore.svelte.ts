export type ErrorEntry = {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  status: number | null;
  code: string;
  message: string;
};

const MAX_ENTRIES = 50;

function createStore() {
  let entries = $state<ErrorEntry[]>([]);

  return {
    get entries() {
      return entries;
    },
    get count() {
      return entries.length;
    },
    add(entry: Omit<ErrorEntry, 'id' | 'timestamp'>) {
      const full: ErrorEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      entries = [full, ...entries].slice(0, MAX_ENTRIES);
    },
    clear() {
      entries = [];
    },
  };
}

export const errorStore = createStore();

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    errorStore.add({
      method: 'UNHANDLED',
      path: '',
      status: null,
      code: reason?.name ?? 'UNHANDLED_REJECTION',
      message: reason?.message ?? String(reason),
    });
  });
}
