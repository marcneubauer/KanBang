import type { ZodType } from 'zod';

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
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetchFn(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ code: 'PARSE_ERROR', error: 'Could not parse error response' }));
    throw new ApiError(
      response.status,
      body.code ?? 'UNKNOWN',
      body.error ?? 'Request failed',
      body.details,
    );
  }

  const data = await response.json();
  return schema ? schema.parse(data) : (data as T);
}

export { ApiError };
