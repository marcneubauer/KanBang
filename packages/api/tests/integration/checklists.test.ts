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

describe('Checklist routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  let boardId: string;
  let listId: string;
  let cardId: string;

  beforeEach(async () => {
    app = await createTestApp();
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;
    const { body: boardBody } = await createBoard(app, cookie, 'Test Board');
    boardId = boardBody.board.id;
    const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
    listId = listBody.list.id;
    const { body: cardBody } = await createCard(app, cookie, listId, 'Test Card');
    cardId = cardBody.card.id;
  });

  afterEach(async () => {
    await app.close();
  });

  async function createChecklist(name = 'My Checklist') {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cards/${cardId}/checklists`,
      headers: authHeader(cookie),
      payload: { name },
    });
    return { response, body: JSON.parse(response.body) };
  }

  async function createItem(checklistId: string, title = 'My Item') {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklistId}/items`,
      headers: authHeader(cookie),
      payload: { title },
    });
    return { response, body: JSON.parse(response.body) };
  }

  describe('POST /api/v1/cards/:cardId/checklists', () => {
    it('creates a checklist', async () => {
      const { response, body } = await createChecklist('Tasks');
      expect(response.statusCode).toBe(201);
      expect(body.checklist.name).toBe('Tasks');
      expect(body.checklist.cardId).toBe(cardId);
      expect(body.checklist.position).toBeDefined();
      expect(body.checklist.items).toEqual([]);
    });

    it('rejects empty name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardId}/checklists`,
        headers: authHeader(cookie),
        payload: { name: '' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 404 for non-existent card', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cards/nonexistent/checklists',
        headers: authHeader(cookie),
        payload: { name: 'Test' },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/cards/:cardId/checklists', () => {
    it('returns checklists with items ordered by position', async () => {
      const { body: cl1 } = await createChecklist('First');
      const { body: cl2 } = await createChecklist('Second');
      await createItem(cl1.checklist.id, 'Item A');
      await createItem(cl1.checklist.id, 'Item B');

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}/checklists`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.checklists).toHaveLength(2);
      expect(body.checklists[0].name).toBe('First');
      expect(body.checklists[0].items).toHaveLength(2);
      expect(body.checklists[0].items[0].title).toBe('Item A');
      expect(body.checklists[1].name).toBe('Second');
      expect(body.checklists[1].items).toHaveLength(0);
    });

    it('returns empty array for card with no checklists', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}/checklists`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(body.checklists).toEqual([]);
    });
  });

  describe('PATCH /api/v1/checklists/:checklistId', () => {
    it('renames a checklist', async () => {
      const { body: cl } = await createChecklist('Old Name');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/checklists/${cl.checklist.id}`,
        headers: authHeader(cookie),
        payload: { name: 'New Name' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.checklist.name).toBe('New Name');
    });

    it('returns 404 for non-existent checklist', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/checklists/nonexistent',
        headers: authHeader(cookie),
        payload: { name: 'Test' },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/v1/checklists/:checklistId/reorder', () => {
    it('reorders a checklist', async () => {
      const { body: cl } = await createChecklist('Test');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/checklists/${cl.checklist.id}/reorder`,
        headers: authHeader(cookie),
        payload: { position: 'z0' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.checklist.position).toBe('z0');
    });
  });

  describe('DELETE /api/v1/checklists/:checklistId', () => {
    it('deletes a checklist and cascades to items', async () => {
      const { body: cl } = await createChecklist('To Delete');
      await createItem(cl.checklist.id, 'Item');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/checklists/${cl.checklist.id}`,
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });

      // Verify checklist and items are gone
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}/checklists`,
        headers: authHeader(cookie),
      });
      expect(JSON.parse(listRes.body).checklists).toHaveLength(0);
    });

    it('returns 404 for non-existent checklist', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/checklists/nonexistent',
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/checklists/:checklistId/items', () => {
    it('creates a checklist item', async () => {
      const { body: cl } = await createChecklist('Tasks');
      const { response, body } = await createItem(cl.checklist.id, 'Buy milk');
      expect(response.statusCode).toBe(201);
      expect(body.item.title).toBe('Buy milk');
      expect(body.item.completed).toBe(false);
      expect(body.item.checklistId).toBe(cl.checklist.id);
    });

    it('rejects empty title', async () => {
      const { body: cl } = await createChecklist('Tasks');
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/checklists/${cl.checklist.id}/items`,
        headers: authHeader(cookie),
        payload: { title: '' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/v1/checklist-items/:itemId', () => {
    it('toggles item completed', async () => {
      const { body: cl } = await createChecklist('Tasks');
      const { body: itemBody } = await createItem(cl.checklist.id, 'Item');

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/checklist-items/${itemBody.item.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.item.completed).toBe(true);
    });

    it('updates item title', async () => {
      const { body: cl } = await createChecklist('Tasks');
      const { body: itemBody } = await createItem(cl.checklist.id, 'Old');

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/checklist-items/${itemBody.item.id}`,
        headers: authHeader(cookie),
        payload: { title: 'New' },
      });
      const body = JSON.parse(response.body);
      expect(body.item.title).toBe('New');
    });

    it('returns 404 for non-existent item', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/checklist-items/nonexistent',
        headers: authHeader(cookie),
        payload: { completed: true },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/v1/checklist-items/:itemId/reorder', () => {
    it('reorders an item', async () => {
      const { body: cl } = await createChecklist('Tasks');
      const { body: itemBody } = await createItem(cl.checklist.id, 'Item');

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/checklist-items/${itemBody.item.id}/reorder`,
        headers: authHeader(cookie),
        payload: { position: 'z0' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.item.position).toBe('z0');
    });
  });

  describe('DELETE /api/v1/checklist-items/:itemId', () => {
    it('deletes an item', async () => {
      const { body: cl } = await createChecklist('Tasks');
      const { body: itemBody } = await createItem(cl.checklist.id, 'Item');

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/checklist-items/${itemBody.item.id}`,
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
    });
  });

  describe('POST /api/v1/checklist-items/:itemId/convert-to-card', () => {
    it('converts item to card and deletes item', async () => {
      const { body: cl } = await createChecklist('Tasks');
      const { body: itemBody } = await createItem(cl.checklist.id, 'Promoted Item');

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/checklist-items/${itemBody.item.id}/convert-to-card`,
        headers: authHeader(cookie),
        payload: { listId },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(201);
      expect(body.card.title).toBe('Promoted Item');
      expect(body.card.listId).toBe(listId);

      // Verify item is deleted
      const checklistRes = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}/checklists`,
        headers: authHeader(cookie),
      });
      const checklists = JSON.parse(checklistRes.body).checklists;
      expect(checklists[0].items).toHaveLength(0);
    });

    it('returns 404 for non-existent item', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/checklist-items/nonexistent/convert-to-card',
        headers: authHeader(cookie),
        payload: { listId },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Progress counts in board detail', () => {
    it('includes checklistProgress in board response', async () => {
      const { body: cl } = await createChecklist('Tasks');
      const { body: i1 } = await createItem(cl.checklist.id, 'Item 1');
      await createItem(cl.checklist.id, 'Item 2');
      await createItem(cl.checklist.id, 'Item 3');

      // Complete one item
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/checklist-items/${i1.item.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });

      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      const card = boardBody.board.lists[0].cards[0];
      expect(card.checklistProgress).toEqual({ total: 3, completed: 1 });
    });

    it('returns zero progress for card with no checklists', async () => {
      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      const card = boardBody.board.lists[0].cards[0];
      expect(card.checklistProgress).toEqual({ total: 0, completed: 0 });
    });
  });

  describe('Ownership', () => {
    it('returns 403 when accessing another user checklists', async () => {
      const { body: cl } = await createChecklist('Private');

      const { sessionCookie: otherCookie } = await registerUser(app, {
        email: 'other@example.com',
        username: 'other',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}/checklists`,
        headers: authHeader(otherCookie!),
      });
      expect(response.statusCode).toBe(403);

      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/checklists/${cl.checklist.id}`,
        headers: authHeader(otherCookie!),
        payload: { name: 'Hacked' },
      });
      expect(patchRes.statusCode).toBe(403);
    });
  });
});
