// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Handle, RequestEvent } from '@sveltejs/kit';

interface EventOptions {
  method?: string;
  headers?: Record<string, string>;
  sessionCookie?: string;
  body?: BodyInit;
}

function makeEvent(path: string, opts: EventOptions = {}): RequestEvent {
  const { method = 'GET', headers = {}, sessionCookie } = opts;
  return {
    url: new URL(`http://localhost:5173${path}`),
    request: new Request(`http://localhost:5173${path}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : (opts.body ?? '{}'),
    }),
    cookies: {
      get: (name: string) => (name === 'kanbang_session' ? sessionCookie : undefined),
    },
    locals: {} as App.Locals,
  } as unknown as RequestEvent;
}

function apiResponse({ status = 200, body = {} }: { status?: number; body?: unknown } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' });
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    body: null,
    headers,
    json: async () => body,
  } as unknown as Response;
}

async function loadHandle(): Promise<Handle> {
  vi.resetModules();
  const mod = await import('../src/hooks.server.js');
  return mod.handle;
}

const resolve = vi.fn(async () => new Response('page'));

beforeEach(() => {
  vi.unstubAllGlobals();
  resolve.mockClear();
});

describe('API proxy header allowlist', () => {
  it('forwards cookie, content-type, and authorization but drops x-forwarded-for and host', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => apiResponse());
    vi.stubGlobal('fetch', fetchMock);
    const handle = await loadHandle();

    await handle({
      event: makeEvent('/api/v1/boards', {
        method: 'POST',
        headers: {
          cookie: 'kanbang_session=abc',
          'content-type': 'application/json',
          'x-forwarded-for': '1.2.3.4',
          authorization: 'Bearer kb_shortcut-token',
          host: 'attacker.example',
        },
      }),
      resolve,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const sent = init.headers as Headers;
    expect(sent.get('cookie')).toBe('kanbang_session=abc');
    expect(sent.get('content-type')).toBe('application/json');
    expect(sent.get('x-forwarded-for')).toBeNull();
    // Authorization must pass through so bearer-token endpoints (quick-add) work via the proxy
    expect(sent.get('authorization')).toBe('Bearer kb_shortcut-token');
    expect(sent.get('host')).toBeNull();
  });

  it('forwards binary request bodies unmangled (image uploads)', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => apiResponse());
    vi.stubGlobal('fetch', fetchMock);
    const handle = await loadHandle();

    // Bytes that are not valid UTF-8 — request.text() would mangle them
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x9f, 0x80, 0xfe]);
    await handle({
      event: makeEvent('/api/v1/cards/c1/attachments', {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=x' },
        body: bytes,
      }),
      resolve,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const forwarded = new Uint8Array(
      await new Response(init.body as ReadableStream).arrayBuffer(),
    );
    expect(forwarded).toEqual(bytes);
  });

  it('does not call /auth/me for proxied API requests', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => apiResponse());
    vi.stubGlobal('fetch', fetchMock);
    const handle = await loadHandle();

    await handle({
      event: makeEvent('/api/v1/boards', { sessionCookie: 'abc' }),
      resolve,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/auth/me');
  });
});

describe('auth cache', () => {
  it('two page requests with the same session make one /auth/me call', async () => {
    const fetchMock = vi.fn(async () => apiResponse({ body: { user: { id: 'u1' } } }));
    vi.stubGlobal('fetch', fetchMock);
    const handle = await loadHandle();

    const first = makeEvent('/boards', { sessionCookie: 'sess1' });
    const second = makeEvent('/boards', { sessionCookie: 'sess1' });
    await handle({ event: first, resolve });
    await handle({ event: second, resolve });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.locals.user).toEqual({ id: 'u1' });
    expect(second.locals.user).toEqual({ id: 'u1' });
  });

  it('does not cache failed auth lookups', async () => {
    const fetchMock = vi.fn(async () => apiResponse({ status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const handle = await loadHandle();

    const first = makeEvent('/boards', { sessionCookie: 'bad' });
    await handle({ event: first, resolve });
    await handle({ event: makeEvent('/boards', { sessionCookie: 'bad' }), resolve });

    expect(first.locals.user).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('logout invalidates the cached session', async () => {
    const fetchMock = vi.fn(async () => apiResponse({ body: { user: { id: 'u1' } } }));
    vi.stubGlobal('fetch', fetchMock);
    const handle = await loadHandle();

    await handle({ event: makeEvent('/boards', { sessionCookie: 'sess1' }), resolve });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await handle({
      event: makeEvent('/api/v1/auth/logout', { method: 'POST', sessionCookie: 'sess1' }),
      resolve,
    });

    await handle({ event: makeEvent('/boards', { sessionCookie: 'sess1' }), resolve });
    // 1 initial /auth/me + 1 logout proxy + 1 fresh /auth/me after invalidation
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
