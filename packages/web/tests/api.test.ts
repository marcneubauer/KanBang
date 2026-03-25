import { describe, it, expect } from 'vitest';
import { api, ApiError } from '../src/lib/api.js';

function mockFetch(status: number, body: unknown): typeof fetch {
  return async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }) as unknown as Response;
}

function mockFetchBadJson(status: number): typeof fetch {
  return async () =>
    ({
      ok: false,
      status,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    }) as unknown as Response;
}

describe('api()', () => {
  it('prepends /api/v1 to path and passes credentials include', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit = {};
    const fetchFn: typeof fetch = async (url, init) => {
      capturedUrl = url as string;
      capturedInit = init ?? {};
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    };

    await api('/boards', {}, fetchFn);
    expect(capturedUrl).toBe('/api/v1/boards');
    expect(capturedInit.credentials).toBe('include');
  });

  it('sets Content-Type for string body', async () => {
    let capturedHeaders: Record<string, string> = {};
    const fetchFn: typeof fetch = async (_url, init) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    };

    await api('/boards', { method: 'POST', body: JSON.stringify({ name: 'x' }) }, fetchFn);
    expect(capturedHeaders['Content-Type']).toBe('application/json');
  });

  it('does not set Content-Type when no body', async () => {
    let capturedHeaders: Record<string, string> = {};
    const fetchFn: typeof fetch = async (_url, init) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    };

    await api('/boards', {}, fetchFn);
    expect(capturedHeaders['Content-Type']).toBeUndefined();
  });

  it('throws ApiError with status, code, and message on non-ok response', async () => {
    const fetchFn = mockFetch(404, { error: 'Not found', code: 'NOT_FOUND' });

    await expect(api('/boards/x', {}, fetchFn)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Not found',
    });
  });

  it('falls back to UNKNOWN code when response body has no code field', async () => {
    const fetchFn = mockFetch(500, { error: 'boom' });

    await expect(api('/boards', {}, fetchFn)).rejects.toMatchObject({
      status: 500,
      code: 'UNKNOWN',
    });
  });

  it('falls back to PARSE_ERROR when response body is not valid JSON', async () => {
    const fetchFn = mockFetchBadJson(500);

    await expect(api('/boards', {}, fetchFn)).rejects.toBeInstanceOf(ApiError);
    await expect(api('/boards', {}, fetchFn)).rejects.toMatchObject({
      code: 'PARSE_ERROR',
      message: 'Could not parse error response',
    });
  });

  it('throws ApiError instance', async () => {
    const fetchFn = mockFetch(401, { error: 'Unauthorized', code: 'UNAUTHORIZED' });

    await expect(api('/me', {}, fetchFn)).rejects.toBeInstanceOf(ApiError);
  });
});
