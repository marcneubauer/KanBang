import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  createTestApp,
  registerUser,
  authHeader,
  createBoard,
  createList,
  createCard,
} from './helpers.js';

describe('Board routes', () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeEach(async () => {
    app = await createTestApp();
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/boards', () => {
    it('creates a board', async () => {
      const { response, body } = await createBoard(app, cookie, 'My Board');
      expect(response.statusCode).toBe(201);
      expect(body.board.name).toBe('My Board');
      expect(body.board.id).toBeDefined();
    });

    it('rejects empty name', async () => {
      const { response, body } = await createBoard(app, cookie, '');
      expect(response.statusCode).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/boards',
        payload: { name: 'Test' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/boards', () => {
    it('returns user boards', async () => {
      await createBoard(app, cookie, 'Board 1');
      await createBoard(app, cookie, 'Board 2');

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/boards',
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.boards).toHaveLength(2);
    });

    it('does not return other users boards', async () => {
      await createBoard(app, cookie, 'Board 1');

      const { sessionCookie: otherCookie } = await registerUser(app, {
        email: 'other@example.com',
        username: 'other',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/boards',
        headers: authHeader(otherCookie!),
      });
      const body = JSON.parse(response.body);
      expect(body.boards).toHaveLength(0);
    });
  });

  describe('GET /api/v1/boards/:boardId', () => {
    it('returns board with lists and cards', async () => {
      const { body: boardBody } = await createBoard(app, cookie, 'My Board');
      const boardId = boardBody.board.id;

      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      await createCard(app, cookie, listBody.list.id, 'Task 1');
      await createCard(app, cookie, listBody.list.id, 'Task 2');

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.board.name).toBe('My Board');
      expect(body.board.lists).toHaveLength(1);
      expect(body.board.lists[0].name).toBe('To Do');
      expect(body.board.lists[0].cards).toHaveLength(2);
    });

    it('returns 404 for non-existent board', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/boards/nonexistent',
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns 403 for other users board', async () => {
      const { body: boardBody } = await createBoard(app, cookie, 'My Board');
      const { sessionCookie: otherCookie } = await registerUser(app, {
        email: 'other@example.com',
        username: 'other',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardBody.board.id}`,
        headers: authHeader(otherCookie!),
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/v1/boards/:boardId', () => {
    it('updates board name', async () => {
      const { body: boardBody } = await createBoard(app, cookie);
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/boards/${boardBody.board.id}`,
        headers: authHeader(cookie),
        payload: { name: 'Updated Name' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.board.name).toBe('Updated Name');
    });

    it('sets and clears card aging without touching the name', async () => {
      const { body: boardBody } = await createBoard(app, cookie, 'Aging Board');
      const boardId = boardBody.board.id;

      const setRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
        payload: { cardAgingDays: 14 },
      });
      const setBody = JSON.parse(setRes.body);
      expect(setRes.statusCode).toBe(200);
      expect(setBody.board.cardAgingDays).toBe(14);
      expect(setBody.board.name).toBe('Aging Board');

      const clearRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
        payload: { cardAgingDays: null },
      });
      expect(JSON.parse(clearRes.body).board.cardAgingDays).toBeNull();
    });

    it('sets a color background', async () => {
      const { body: boardBody } = await createBoard(app, cookie);
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/boards/${boardBody.board.id}`,
        headers: authHeader(cookie),
        payload: { backgroundType: 'color', backgroundValue: '#0079bf' },
      });
      const body = JSON.parse(res.body);
      expect(res.statusCode).toBe(200);
      expect(body.board.backgroundType).toBe('color');
      expect(body.board.backgroundValue).toBe('#0079bf');
    });

    it('sets a gradient background and clears it with nulls', async () => {
      const { body: boardBody } = await createBoard(app, cookie);
      const setRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/boards/${boardBody.board.id}`,
        headers: authHeader(cookie),
        payload: { backgroundType: 'gradient', backgroundValue: 'ocean' },
      });
      expect(JSON.parse(setRes.body).board.backgroundValue).toBe('ocean');

      const clearRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/boards/${boardBody.board.id}`,
        headers: authHeader(cookie),
        payload: { backgroundType: null, backgroundValue: null },
      });
      const cleared = JSON.parse(clearRes.body).board;
      expect(cleared.backgroundType).toBeNull();
      expect(cleared.backgroundValue).toBeNull();
    });

    it('rejects invalid backgrounds', async () => {
      const { body: boardBody } = await createBoard(app, cookie);
      const invalidPayloads = [
        { backgroundType: 'color', backgroundValue: 'not-a-hex' },
        { backgroundType: 'color', backgroundValue: '#12345' },
        { backgroundType: 'gradient', backgroundValue: 'unknown-preset' },
        { backgroundType: 'stripes', backgroundValue: '#0079bf' },
        { backgroundType: 'color' },
        { backgroundValue: '#0079bf' },
        { backgroundType: null, backgroundValue: 'ocean' },
      ];
      for (const payload of invalidPayloads) {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/boards/${boardBody.board.id}`,
          headers: authHeader(cookie),
          payload,
        });
        expect(res.statusCode).toBe(400);
      }
    });

    it('rejects out-of-range card aging values', async () => {
      const { body: boardBody } = await createBoard(app, cookie);
      for (const cardAgingDays of [0, -5, 366, 'soon']) {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/boards/${boardBody.board.id}`,
          headers: authHeader(cookie),
          payload: { cardAgingDays },
        });
        expect(res.statusCode).toBe(400);
      }
    });
  });

  describe('PATCH /api/v1/boards/:boardId/archive', () => {
    it('archives board and removes it from active list', async () => {
      const { body: boardBody } = await createBoard(app, cookie);
      const boardId = boardBody.board.id;

      const archiveRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/boards/${boardId}/archive`,
        headers: authHeader(cookie),
      });
      expect(archiveRes.statusCode).toBe(200);
      expect(JSON.parse(archiveRes.body)).toEqual({ ok: true });

      // Board absent from active list
      const activeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/boards',
        headers: authHeader(cookie),
      });
      const activeBody = JSON.parse(activeRes.body);
      expect(activeBody.boards.map((b: { id: string }) => b.id)).not.toContain(boardId);

      // Board appears in archived list
      const archivedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/boards?archived=true',
        headers: authHeader(cookie),
      });
      const archivedBody = JSON.parse(archivedRes.body);
      expect(archivedBody.boards.map((b: { id: string }) => b.id)).toContain(boardId);
    });

    it('unarchives board and restores it to active list', async () => {
      const { body: boardBody } = await createBoard(app, cookie);
      const boardId = boardBody.board.id;

      await app.inject({ method: 'PATCH', url: `/api/v1/boards/${boardId}/archive`, headers: authHeader(cookie) });

      const unarchiveRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/boards/${boardId}/unarchive`,
        headers: authHeader(cookie),
      });
      expect(unarchiveRes.statusCode).toBe(200);

      const activeRes = await app.inject({
        method: 'GET',
        url: '/api/v1/boards',
        headers: authHeader(cookie),
      });
      const activeBody = JSON.parse(activeRes.body);
      expect(activeBody.boards.map((b: { id: string }) => b.id)).toContain(boardId);
    });

    it('lists and cards are independent of board archive state', async () => {
      const { body: boardBody } = await createBoard(app, cookie);
      const boardId = boardBody.board.id;
      const { body: listBody } = await createList(app, cookie, boardId);
      const listId = listBody.list.id;
      const { body: cardBody } = await createCard(app, cookie, listId, 'Card 1');
      const cardId = cardBody.card.id;

      await app.inject({ method: 'PATCH', url: `/api/v1/boards/${boardId}/archive`, headers: authHeader(cookie) });

      // List and card still accessible
      const listRes = await app.inject({ method: 'GET', url: `/api/v1/lists/${listId}`, headers: authHeader(cookie) });
      expect(listRes.statusCode).toBe(200);

      const cardRes = await app.inject({ method: 'GET', url: `/api/v1/cards/${cardId}`, headers: authHeader(cookie) });
      expect(cardRes.statusCode).toBe(200);
    });
  });
});
