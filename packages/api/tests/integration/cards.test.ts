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

describe('Card routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  let boardId: string;
  let listId: string;

  beforeEach(async () => {
    app = await createTestApp();
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;
    const { body: boardBody } = await createBoard(app, cookie, 'Test Board');
    boardId = boardBody.board.id;
    const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
    listId = listBody.list.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/lists/:listId/cards', () => {
    it('creates a card', async () => {
      const { response, body } = await createCard(app, cookie, listId, 'My Task', 'Description');
      expect(response.statusCode).toBe(201);
      expect(body.card.title).toBe('My Task');
      expect(body.card.description).toBe('Description');
      expect(body.card.listId).toBe(listId);
      expect(body.card.position).toBeDefined();
    });

    it('creates card without description', async () => {
      const { response, body } = await createCard(app, cookie, listId, 'No Desc');
      expect(response.statusCode).toBe(201);
      expect(body.card.description).toBeNull();
    });

    it('assigns ordered positions to multiple cards', async () => {
      const { body: c1 } = await createCard(app, cookie, listId, 'Card 1');
      const { body: c2 } = await createCard(app, cookie, listId, 'Card 2');
      const { body: c3 } = await createCard(app, cookie, listId, 'Card 3');

      expect(c1.card.position < c2.card.position).toBe(true);
      expect(c2.card.position < c3.card.position).toBe(true);
    });

    it('rejects empty title', async () => {
      const { response } = await createCard(app, cookie, listId, '');
      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/v1/cards/:cardId', () => {
    it('updates card title', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Old Title');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { title: 'New Title' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.title).toBe('New Title');
    });

    it('updates card description', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Task');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { description: 'Added description' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.description).toBe('Added description');
    });

    it('sets description to null', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Task', 'Has desc');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { description: null },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.description).toBeNull();
    });
  });

  describe('PATCH /api/v1/cards/:cardId/move', () => {
    it('moves card within same list', async () => {
      const { body: c1 } = await createCard(app, cookie, listId, 'Card 1');
      await createCard(app, cookie, listId, 'Card 2');

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${c1.card.id}/move`,
        headers: authHeader(cookie),
        payload: { listId, position: 'z0' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.listId).toBe(listId);
      expect(body.card.position).toBe('z0');
    });

    it('moves card to different list', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Card 1');
      const { body: list2Body } = await createList(app, cookie, boardId, 'In Progress');

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}/move`,
        headers: authHeader(cookie),
        payload: { listId: list2Body.list.id, position: 'a0' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.listId).toBe(list2Body.list.id);
      expect(body.card.position).toBe('a0');

      // Verify board shows card in new list
      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      const sourceList = boardBody.board.lists.find((l: { id: string }) => l.id === listId);
      const targetList = boardBody.board.lists.find((l: { id: string }) => l.id === list2Body.list.id);
      expect(sourceList.cards).toHaveLength(0);
      expect(targetList.cards).toHaveLength(1);
    });
  });

  describe('DELETE /api/v1/cards/:cardId', () => {
    it('deletes a card', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'To Delete');
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(200);

      // Verify card is gone from board
      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      expect(boardBody.board.lists[0].cards).toHaveLength(0);
    });

    it('returns 404 for non-existent card', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/cards/nonexistent',
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
