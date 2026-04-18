import type { ZodType } from 'zod';
import { errorStore } from './errorStore.svelte';

const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  schema?: ZodType<T>,
  fetchFn: typeof fetch = fetch,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetchFn(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    errorStore.add({
      method,
      path,
      status: null,
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : 'Network request failed',
    });
    throw err;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: 'PARSE_ERROR', error: 'Could not parse error response' }));
    const apiErr = new ApiError(
      response.status,
      body.code ?? 'UNKNOWN',
      body.error ?? 'Request failed',
      body.details,
    );
    errorStore.add({
      method,
      path,
      status: apiErr.status,
      code: apiErr.code,
      message: apiErr.message,
    });
    throw apiErr;
  }

  const data = await response.json();
  return schema ? schema.parse(data) : (data as T);
}

export { ApiError };
