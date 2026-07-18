import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createTestApp,
  registerUser,
  authHeader,
  createBoard,
  createList,
} from './helpers.js';

async function generateToken(app: FastifyInstance, cookie: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/quick-add/token',
    headers: authHeader(cookie),
  });
  return JSON.parse(res.body).token;
}

async function setDefaultList(app: FastifyInstance, cookie: string, listId: string | null) {
  return app.inject({
    method: 'PUT',
    url: '/api/v1/quick-add/config',
    headers: authHeader(cookie),
    payload: { listId },
  });
}

async function quickAdd(app: FastifyInstance, token: string | null, text: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/quick-add',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: { text },
  });
  return { response, body: JSON.parse(response.body) };
}

describe('Quick-add routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  let boardId: string;
  let listId: string;

  beforeEach(async () => {
    app = await createTestApp();
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;
    const { body: boardBody } = await createBoard(app, cookie, 'Inbox Board');
    boardId = boardBody.board.id;
    const { body: listBody } = await createList(app, cookie, boardId, 'Inbox');
    listId = listBody.list.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('token management', () => {
    it('generates a token with kb_ prefix', async () => {
      const token = await generateToken(app, cookie);
      expect(token).toMatch(/^kb_[A-Za-z0-9_-]{40,}$/);
    });

    it('reports token info in config', async () => {
      await generateToken(app, cookie);
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/quick-add/config',
        headers: authHeader(cookie),
      });
      const body = JSON.parse(res.body);
      expect(body.token.createdAt).toBeDefined();
      expect(body.token.lastUsedAt).toBeNull();
    });

    it('rotating invalidates the previous token', async () => {
      const first = await generateToken(app, cookie);
      await setDefaultList(app, cookie, listId);
      await generateToken(app, cookie);

      const { response } = await quickAdd(app, first, 'should fail');
      expect(response.statusCode).toBe(401);
    });

    it('revoking removes the token', async () => {
      const token = await generateToken(app, cookie);
      await setDefaultList(app, cookie, listId);

      const del = await app.inject({
        method: 'DELETE',
        url: '/api/v1/quick-add/token',
        headers: authHeader(cookie),
      });
      expect(del.statusCode).toBe(200);

      const { response } = await quickAdd(app, token, 'should fail');
      expect(response.statusCode).toBe(401);
    });

    it('requires session auth for token routes', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/v1/quick-add/token' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('config', () => {
    it('sets and reads the default list', async () => {
      const res = await setDefaultList(app, cookie, listId);
      expect(res.statusCode).toBe(200);

      const config = await app.inject({
        method: 'GET',
        url: '/api/v1/quick-add/config',
        headers: authHeader(cookie),
      });
      const body = JSON.parse(config.body);
      expect(body.list).toEqual({
        listId,
        listName: 'Inbox',
        boardId,
        boardName: 'Inbox Board',
      });
    });

    it('rejects a list the user does not own', async () => {
      const { sessionCookie: otherCookie } = await registerUser(app, {
        email: 'other@example.com',
        username: 'otheruser',
      });
      const { body: otherBoard } = await createBoard(app, otherCookie!, 'Other Board');
      const { body: otherList } = await createList(app, otherCookie!, otherBoard.board.id);

      const res = await setDefaultList(app, cookie, otherList.list.id);
      expect(res.statusCode).toBe(403);
    });

    it('clears the default list with null', async () => {
      await setDefaultList(app, cookie, listId);
      const res = await setDefaultList(app, cookie, null);
      expect(res.statusCode).toBe(200);

      const config = await app.inject({
        method: 'GET',
        url: '/api/v1/quick-add/config',
        headers: authHeader(cookie),
      });
      expect(JSON.parse(config.body).list).toBeNull();
    });
  });

  describe('POST /api/v1/quick-add', () => {
    it('creates a card on the default list', async () => {
      const token = await generateToken(app, cookie);
      await setDefaultList(app, cookie, listId);

      const { response, body } = await quickAdd(app, token, 'buy milk');
      expect(response.statusCode).toBe(201);
      expect(body.card.title).toBe('buy milk');
      expect(body.card.listId).toBe(listId);
      expect(body.board).toBe('Inbox Board');
      expect(body.list).toBe('Inbox');
    });

    it('rejects missing or invalid tokens', async () => {
      await setDefaultList(app, cookie, listId);
      const { response: noToken } = await quickAdd(app, null, 'buy milk');
      expect(noToken.statusCode).toBe(401);

      const { response: badToken } = await quickAdd(app, 'kb_not_a_real_token', 'buy milk');
      expect(badToken.statusCode).toBe(401);
    });

    it('returns 409 when no default list is configured', async () => {
      const token = await generateToken(app, cookie);
      const { response, body } = await quickAdd(app, token, 'buy milk');
      expect(response.statusCode).toBe(409);
      expect(body.code).toBe('QUICK_ADD_NOT_CONFIGURED');
    });

    it('routes "Board name: title" to the named board first list', async () => {
      const token = await generateToken(app, cookie);
      await setDefaultList(app, cookie, listId);

      const { body: otherBoard } = await createBoard(app, cookie, 'Groceries');
      const { body: groceryList } = await createList(app, cookie, otherBoard.board.id, 'To Buy');

      const { response, body } = await quickAdd(app, token, 'groceries: bananas');
      expect(response.statusCode).toBe(201);
      expect(body.card.title).toBe('bananas');
      expect(body.card.listId).toBe(groceryList.list.id);
      expect(body.board).toBe('Groceries');
    });

    it('falls back to the default list when prefix matches no board', async () => {
      const token = await generateToken(app, cookie);
      await setDefaultList(app, cookie, listId);

      const { response, body } = await quickAdd(app, token, 'note: call the dentist');
      expect(response.statusCode).toBe(201);
      expect(body.card.title).toBe('note: call the dentist');
      expect(body.card.listId).toBe(listId);
    });

    it('updates lastUsedAt on successful use', async () => {
      const token = await generateToken(app, cookie);
      await setDefaultList(app, cookie, listId);
      await quickAdd(app, token, 'buy milk');

      const config = await app.inject({
        method: 'GET',
        url: '/api/v1/quick-add/config',
        headers: authHeader(cookie),
      });
      expect(JSON.parse(config.body).token.lastUsedAt).not.toBeNull();
    });

    it('rejects empty text', async () => {
      const token = await generateToken(app, cookie);
      await setDefaultList(app, cookie, listId);
      const { response } = await quickAdd(app, token, '   ');
      expect(response.statusCode).toBe(400);
    });

    it('returns 409 when the default list was archived', async () => {
      const token = await generateToken(app, cookie);
      await setDefaultList(app, cookie, listId);

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listId}/archive`,
        headers: authHeader(cookie),
      });

      const { response } = await quickAdd(app, token, 'buy milk');
      expect(response.statusCode).toBe(409);
    });
  });
});
