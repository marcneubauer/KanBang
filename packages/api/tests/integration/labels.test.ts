import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, registerUser, authHeader } from './helpers.js';

describe('Label routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  let boardId: string;
  let listId: string;
  let cardId: string;

  beforeEach(async () => {
    app = await createTestApp();
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;

    const boardRes = await app.inject({
      method: 'POST',
      url: '/api/v1/boards',
      headers: authHeader(cookie),
      payload: { name: 'Board' },
    });
    boardId = JSON.parse(boardRes.body).board.id;

    const listRes = await app.inject({
      method: 'POST',
      url: `/api/v1/boards/${boardId}/lists`,
      headers: authHeader(cookie),
      payload: { name: 'Todo' },
    });
    listId = JSON.parse(listRes.body).list.id;

    const cardRes = await app.inject({
      method: 'POST',
      url: `/api/v1/lists/${listId}/cards`,
      headers: authHeader(cookie),
      payload: { title: 'Card' },
    });
    cardId = JSON.parse(cardRes.body).card.id;
  });

  afterEach(async () => {
    await app.close();
  });

  async function createLabel(name = 'Bug', color = '#eb5a46') {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/boards/${boardId}/labels`,
      headers: authHeader(cookie),
      payload: { name, color },
    });
    return { response, body: JSON.parse(response.body) };
  }

  describe('POST /api/v1/boards/:boardId/labels', () => {
    it('creates a label', async () => {
      const { response, body } = await createLabel();
      expect(response.statusCode).toBe(201);
      expect(body.label.name).toBe('Bug');
      expect(body.label.color).toBe('#eb5a46');
      expect(body.label.boardId).toBe(boardId);
    });

    it('allows an empty name (color-only label)', async () => {
      const { response } = await createLabel('');
      expect(response.statusCode).toBe(201);
    });

    it('rejects an invalid color', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/boards/${boardId}/labels`,
        headers: authHeader(cookie),
        payload: { name: 'Bad', color: 'red' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 403 for another users board', async () => {
      const other = await registerUser(app, { email: 'o@example.com', username: 'otheruser' });
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/boards/${boardId}/labels`,
        headers: authHeader(other.sessionCookie!),
        payload: { name: 'Nope', color: '#61bd4f' },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/boards/:boardId/labels', () => {
    it('lists board labels', async () => {
      await createLabel('Bug', '#eb5a46');
      await createLabel('Feature', '#61bd4f');

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}/labels`,
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(200);
      const { labels } = JSON.parse(response.body);
      expect(labels).toHaveLength(2);
      expect(labels.map((l: { name: string }) => l.name)).toEqual(['Bug', 'Feature']);
    });
  });

  describe('PATCH /api/v1/labels/:labelId', () => {
    it('updates name and color', async () => {
      const { body } = await createLabel();
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/labels/${body.label.id}`,
        headers: authHeader(cookie),
        payload: { name: 'Critical', color: '#c377e0' },
      });
      expect(response.statusCode).toBe(200);
      const { label } = JSON.parse(response.body);
      expect(label.name).toBe('Critical');
      expect(label.color).toBe('#c377e0');
    });

    it('returns 404 for a non-existent label', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/labels/nonexistent',
        headers: authHeader(cookie),
        payload: { name: 'X' },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('card label assignment', () => {
    it('assigns and removes a label; board detail reflects it', async () => {
      const { body } = await createLabel();
      const labelId = body.label.id;

      const addRes = await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardId}/labels/${labelId}`,
        headers: authHeader(cookie),
      });
      expect(addRes.statusCode).toBe(200);

      let boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      let { board } = JSON.parse(boardRes.body);
      expect(board.labels).toHaveLength(1);
      expect(board.lists[0].cards[0].labelIds).toEqual([labelId]);

      const removeRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/cards/${cardId}/labels/${labelId}`,
        headers: authHeader(cookie),
      });
      expect(removeRes.statusCode).toBe(200);

      boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      ({ board } = JSON.parse(boardRes.body));
      expect(board.lists[0].cards[0].labelIds).toEqual([]);
    });

    it('assigning twice is idempotent', async () => {
      const { body } = await createLabel();
      const labelId = body.label.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardId}/labels/${labelId}`,
        headers: authHeader(cookie),
      });
      const second = await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardId}/labels/${labelId}`,
        headers: authHeader(cookie),
      });
      expect(second.statusCode).toBe(200);

      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const { board } = JSON.parse(boardRes.body);
      expect(board.lists[0].cards[0].labelIds).toEqual([labelId]);
    });

    it('rejects assigning a label from a different board', async () => {
      const otherBoardRes = await app.inject({
        method: 'POST',
        url: '/api/v1/boards',
        headers: authHeader(cookie),
        payload: { name: 'Other board' },
      });
      const otherBoardId = JSON.parse(otherBoardRes.body).board.id;

      const labelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/boards/${otherBoardId}/labels`,
        headers: authHeader(cookie),
        payload: { name: 'Foreign', color: '#0079bf' },
      });
      const foreignLabelId = JSON.parse(labelRes.body).label.id;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardId}/labels/${foreignLabelId}`,
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/labels/:labelId', () => {
    it('deletes a label and removes it from cards', async () => {
      const { body } = await createLabel();
      const labelId = body.label.id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardId}/labels/${labelId}`,
        headers: authHeader(cookie),
      });

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/labels/${labelId}`,
        headers: authHeader(cookie),
      });
      expect(deleteRes.statusCode).toBe(200);

      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const { board } = JSON.parse(boardRes.body);
      expect(board.labels).toHaveLength(0);
      expect(board.lists[0].cards[0].labelIds).toEqual([]);
    });
  });

  it('requires auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/boards/${boardId}/labels`,
    });
    expect(response.statusCode).toBe(401);
  });
});
