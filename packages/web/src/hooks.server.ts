import type { Handle } from '@sveltejs/kit';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export const handle: Handle = async ({ event, resolve }) => {
  // Forward the session cookie to the API to check auth
  const sessionCookie = event.cookies.get('kanbang_session');

  if (sessionCookie) {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { cookie: `kanbang_session=${sessionCookie}` },
      });
      if (res.ok) {
        const { user } = await res.json();
        event.locals.user = user;
      } else {
        event.locals.user = null;
      }
    } catch {
      event.locals.user = null;
    }
  } else {
    event.locals.user = null;
  }

  // Proxy API requests to the backend
  if (event.url.pathname.startsWith('/api/')) {
    const apiUrl = `${API_URL}${event.url.pathname}${event.url.search}`;
    const response = await fetch(apiUrl, {
      method: event.request.method,
      headers: event.request.headers,
      body: event.request.method !== 'GET' ? await event.request.text() : undefined,
      // @ts-expect-error: duplex is required at runtime for streaming bodies but missing from RequestInit types
      duplex: 'half',
    });

    // Build headers manually — the Fetch API's Headers object strips Set-Cookie
    const proxyHeaders = new Headers(response.headers);
    const setCookies = response.headers.getSetCookie();
    const res = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: proxyHeaders,
    });
    // Re-append Set-Cookie headers that got stripped
    for (const cookie of setCookies) {
      res.headers.append('set-cookie', cookie);
    }
    return res;
  }

  return resolve(event);
};
