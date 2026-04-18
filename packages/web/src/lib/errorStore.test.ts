import { describe, it, expect, beforeEach } from 'vitest';
import { errorStore } from './errorStore.svelte';

describe('errorStore', () => {
  beforeEach(() => {
    errorStore.clear();
  });

  it('add() prepends an entry with generated id and timestamp', () => {
    const before = Date.now();
    errorStore.add({
      method: 'GET',
      path: '/boards',
      status: 500,
      code: 'BOOM',
      message: 'kaboom',
    });
    const after = Date.now();

    expect(errorStore.count).toBe(1);
    const [entry] = errorStore.entries;
    expect(entry.id).toBeTypeOf('string');
    expect(entry.id.length).toBeGreaterThan(0);
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/boards');
    expect(entry.status).toBe(500);
    expect(entry.code).toBe('BOOM');
    expect(entry.message).toBe('kaboom');

    errorStore.add({
      method: 'POST',
      path: '/boards',
      status: 400,
      code: 'BAD',
      message: 'bad',
    });
    expect(errorStore.count).toBe(2);
    expect(errorStore.entries[0].code).toBe('BAD');
    expect(errorStore.entries[1].code).toBe('BOOM');
  });

  it('clear() empties the list', () => {
    errorStore.add({
      method: 'GET',
      path: '/x',
      status: 500,
      code: 'X',
      message: 'x',
    });
    expect(errorStore.count).toBe(1);
    errorStore.clear();
    expect(errorStore.count).toBe(0);
    expect(errorStore.entries).toEqual([]);
  });

  it('caps at 50 entries, dropping the oldest', () => {
    for (let i = 0; i < 51; i++) {
      errorStore.add({
        method: 'GET',
        path: `/p/${i}`,
        status: 500,
        code: 'E',
        message: `msg ${i}`,
      });
    }
    expect(errorStore.count).toBe(50);
    // Newest (index 50) should be first, oldest (index 0) should be gone.
    expect(errorStore.entries[0].message).toBe('msg 50');
    expect(errorStore.entries[49].message).toBe('msg 1');
    expect(errorStore.entries.some((e) => e.message === 'msg 0')).toBe(false);
  });
});
