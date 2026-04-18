import { describe, it, expect, beforeEach } from 'vitest';
import { api } from './api';
import { errorStore } from './errorStore.svelte';

function mockFetch(status: number, body: unknown): typeof fetch {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as unknown as Response;
}

describe('api() integration with errorStore', () => {
  beforeEach(() => {
    errorStore.clear();
  });

  it('records a single entry with status=500 on a 500 response', async () => {
    const fetchFn = mockFetch(500, { code: 'BOOM', error: 'server boom' });

    await expect(api('/boards', {}, undefined, fetchFn)).rejects.toMatchObject({
      status: 500,
      code: 'BOOM',
    });

    expect(errorStore.count).toBe(1);
    const [entry] = errorStore.entries;
    expect(entry.status).toBe(500);
    expect(entry.code).toBe('BOOM');
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/boards');
    expect(entry.message).toBe('server boom');
  });

  it('records status=null and code=NETWORK_ERROR when fetch throws TypeError', async () => {
    const fetchFn: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    await expect(api('/boards', { method: 'POST' }, undefined, fetchFn)).rejects.toBeInstanceOf(
      TypeError,
    );

    expect(errorStore.count).toBe(1);
    const [entry] = errorStore.entries;
    expect(entry.status).toBeNull();
    expect(entry.code).toBe('NETWORK_ERROR');
    expect(entry.method).toBe('POST');
    expect(entry.path).toBe('/boards');
    expect(entry.message).toBe('Failed to fetch');
  });

  it('does not record an entry for a 2xx success', async () => {
    const fetchFn = mockFetch(200, { ok: true });

    await api('/boards', {}, undefined, fetchFn);

    expect(errorStore.count).toBe(0);
  });
});
