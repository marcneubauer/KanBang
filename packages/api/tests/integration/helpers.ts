import type { FastifyInstance } from 'fastify';
import type { LightMyRequestResponse } from 'light-my-request';
import { buildApp } from '../../src/app.js';

export async function createTestApp() {
  const app = await buildApp({
    databaseUrl: ':memory:',
    logger: false,
  });
  await app.ready();
  return app;
}

export function getSessionCookie(response: LightMyRequestResponse): string | undefined {
  const cookies = response.cookies as Array<{ name: string; value: string }>;
  return cookies?.find((c) => c.name === 'kanbang_session')?.value;
}

export async function registerUser(
  app: FastifyInstance,
  data?: { email?: string; username?: string; password?: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: data?.email ?? 'test@example.com',
      username: data?.username ?? 'testuser',
      password: data?.password ?? 'password123',
    },
  });
  return {
    response,
    sessionCookie: getSessionCookie(response),
    body: JSON.parse(response.body),
  };
}

export async function loginUser(
  app: FastifyInstance,
  data?: { email?: string; password?: string },
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: data?.email ?? 'test@example.com',
      password: data?.password ?? 'password123',
    },
  });
  return {
    response,
    sessionCookie: getSessionCookie(response),
    body: JSON.parse(response.body),
  };
}

export function authHeader(sessionCookie: string) {
  return { cookie: `kanbang_session=${sessionCookie}` };
}

export async function createBoard(
  app: FastifyInstance,
  sessionCookie: string,
  name = 'Test Board',
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/boards',
    headers: authHeader(sessionCookie),
    payload: { name },
  });
  return { response, body: JSON.parse(response.body) };
}

export async function createList(
  app: FastifyInstance,
  sessionCookie: string,
  boardId: string,
  name = 'Test List',
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/boards/${boardId}/lists`,
    headers: authHeader(sessionCookie),
    payload: { name },
  });
  return { response, body: JSON.parse(response.body) };
}

export async function createCard(
  app: FastifyInstance,
  sessionCookie: string,
  listId: string,
  title = 'Test Card',
  description?: string,
) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/lists/${listId}/cards`,
    headers: authHeader(sessionCookie),
    payload: { title, description },
  });
  return { response, body: JSON.parse(response.body) };
}
