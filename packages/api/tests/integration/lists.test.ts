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

describe('List routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  let boardId: string;

  beforeEach(async () => {
    app = await createTestApp();
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;
    const { body } = await createBoard(app, cookie, 'Test Board');
    boardId = body.board.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/boards/:boardId/lists', () => {
    it('creates a list', async () => {
      const { response, body } = await createList(app, cookie, boardId, 'To Do');
      expect(response.statusCode).toBe(201);
      expect(body.list.name).toBe('To Do');
      expect(body.list.boardId).toBe(boardId);
      expect(body.list.position).toBeDefined();
    });

    it('assigns ordered positions to multiple lists', async () => {
      const { body: l1 } = await createList(app, cookie, boardId, 'To Do');
      const { body: l2 } = await createList(app, cookie, boardId, 'In Progress');
      const { body: l3 } = await createList(app, cookie, boardId, 'Done');

      expect(l1.list.position < l2.list.position).toBe(true);
      expect(l2.list.position < l3.list.position).toBe(true);
    });

    it('rejects empty name', async () => {
      const { response } = await createList(app, cookie, boardId, '');
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/lists/:listId', () => {
    it('returns list with cards sorted by position', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      await createCard(app, cookie, listBody.list.id, 'Card 1');
      await createCard(app, cookie, listBody.list.id, 'Card 2');
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/lists/${listBody.list.id}`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.list.name).toBe('To Do');
      expect(body.list.boardId).toBe(boardId);
      expect(body.list.cards).toHaveLength(2);
      expect(body.list.cards[0].title).toBe('Card 1');
      expect(body.list.cards[1].title).toBe('Card 2');
      expect(body.list.cards[0].position < body.list.cards[1].position).toBe(true);
    });

    it('returns list with empty cards array', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'Empty');
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/lists/${listBody.list.id}`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.list.cards).toHaveLength(0);
    });

    it('returns 404 for non-existent list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/lists/nonexistent',
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns 404 for another user list', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'Private');
      const { sessionCookie: otherCookie } = await registerUser(app, {
        email: 'other@example.com',
        username: 'other',
      });
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/lists/${listBody.list.id}`,
        headers: authHeader(otherCookie!),
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/v1/lists/:listId', () => {
    it('updates list name', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}`,
        headers: authHeader(cookie),
        payload: { name: 'Done' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.list.name).toBe('Done');
    });

    it('sets and clears the card limit (WIP limit)', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      const listId = listBody.list.id;

      const setRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listId}`,
        headers: authHeader(cookie),
        payload: { cardLimit: 5 },
      });
      expect(setRes.statusCode).toBe(200);
      expect(JSON.parse(setRes.body).list.cardLimit).toBe(5);
      // Name untouched by a limit-only update
      expect(JSON.parse(setRes.body).list.name).toBe('To Do');

      const clearRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listId}`,
        headers: authHeader(cookie),
        payload: { cardLimit: null },
      });
      expect(JSON.parse(clearRes.body).list.cardLimit).toBeNull();
    });

    it('rejects invalid card limits', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      for (const cardLimit of [0, -1, 1.5, 'ten']) {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/lists/${listBody.list.id}`,
          headers: authHeader(cookie),
          payload: { cardLimit },
        });
        expect(res.statusCode).toBe(400);
      }
    });
  });

  describe('POST /api/v1/lists/:listId/copy', () => {
    it('duplicates the list with its cards, checklists, and labels', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      const listId = listBody.list.id;
      const { body: cardBody } = await createCard(app, cookie, listId, 'Task A');

      // checklist on the card
      const clRes = await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardBody.card.id}/checklists`,
        headers: authHeader(cookie),
        payload: { name: 'Steps' },
      });
      const { checklist } = JSON.parse(clRes.body);
      await app.inject({
        method: 'POST',
        url: `/api/v1/checklists/${checklist.id}/items`,
        headers: authHeader(cookie),
        payload: { title: 'one' },
      });

      // label on the card
      const labelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/boards/${boardId}/labels`,
        headers: authHeader(cookie),
        payload: { name: 'tag', color: '#0079bf' },
      });
      const { label } = JSON.parse(labelRes.body);
      await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardBody.card.id}/labels/${label.id}`,
        headers: authHeader(cookie),
      });

      const copyRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lists/${listId}/copy`,
        headers: authHeader(cookie),
      });
      expect(copyRes.statusCode).toBe(201);
      const { list: copy } = JSON.parse(copyRes.body);
      expect(copy.name).toBe('To Do (copy)');
      expect(copy.boardId).toBe(boardId);

      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const board = JSON.parse(boardRes.body).board;
      const copiedList = board.lists.find((l: { id: string }) => l.id === copy.id);
      expect(copiedList.cards).toHaveLength(1);
      expect(copiedList.cards[0].title).toBe('Task A');
      expect(copiedList.cards[0].id).not.toBe(cardBody.card.id);
      expect(copiedList.cards[0].labelIds).toEqual([label.id]);
      expect(copiedList.cards[0].checklistProgress.total).toBe(1);
    });
  });

  describe('PATCH /api/v1/lists/:listId/move-to-board', () => {
    it('moves the list and its cards to another board, dropping label assignments', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'Movable');
      const listId = listBody.list.id;
      const { body: cardBody } = await createCard(app, cookie, listId, 'Task');

      const labelRes = await app.inject({
        method: 'POST',
        url: `/api/v1/boards/${boardId}/labels`,
        headers: authHeader(cookie),
        payload: { name: 'tag', color: '#0079bf' },
      });
      const { label } = JSON.parse(labelRes.body);
      await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardBody.card.id}/labels/${label.id}`,
        headers: authHeader(cookie),
      });

      const { body: otherBoard } = await createBoard(app, cookie, 'Target Board');

      const moveRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listId}/move-to-board`,
        headers: authHeader(cookie),
        payload: { boardId: otherBoard.board.id },
      });
      expect(moveRes.statusCode).toBe(200);
      expect(JSON.parse(moveRes.body).list.boardId).toBe(otherBoard.board.id);

      // Gone from the source board
      const srcRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      expect(
        JSON.parse(srcRes.body).board.lists.find((l: { id: string }) => l.id === listId),
      ).toBeUndefined();

      // Present on the target board, card intact, labels dropped
      const dstRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${otherBoard.board.id}`,
        headers: authHeader(cookie),
      });
      const moved = JSON.parse(dstRes.body).board.lists.find(
        (l: { id: string }) => l.id === listId,
      );
      expect(moved).toBeDefined();
      expect(moved.cards).toHaveLength(1);
      expect(moved.cards[0].labelIds).toHaveLength(0);
    });

    it('resets the Done designation on cross-board move', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'Done');
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });

      const { body: otherBoard } = await createBoard(app, cookie, 'Target');
      const moveRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/move-to-board`,
        headers: authHeader(cookie),
        payload: { boardId: otherBoard.board.id },
      });
      expect(JSON.parse(moveRes.body).list.isDone).toBe(false);
    });

    it("rejects moving to another user's board", async () => {
      const { body: listBody } = await createList(app, cookie, boardId);
      const { sessionCookie: otherCookie } = await registerUser(app, {
        email: 'other@example.com',
        username: 'otheruser',
      });
      const { body: otherBoard } = await createBoard(app, otherCookie!, 'Their Board');

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/move-to-board`,
        headers: authHeader(cookie),
        payload: { boardId: otherBoard.board.id },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/v1/lists/:listId/reorder', () => {
    it('updates list position', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/reorder`,
        headers: authHeader(cookie),
        payload: { position: 'b0' },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.list.position).toBe('b0');
    });
  });

  describe('PATCH /api/v1/lists/:listId/archive', () => {
    it('archives list and removes it from board active view', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      await createCard(app, cookie, listBody.list.id, 'Task 1');

      const archiveRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/archive`,
        headers: authHeader(cookie),
      });
      expect(archiveRes.statusCode).toBe(200);
      expect(JSON.parse(archiveRes.body)).toEqual({ ok: true });

      // Board detail shows no active lists
      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      expect(boardBody.board.lists).toHaveLength(0);
    });

    it('unarchives list and restores it to board active view', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      const listId = listBody.list.id;

      await app.inject({ method: 'PATCH', url: `/api/v1/lists/${listId}/archive`, headers: authHeader(cookie) });

      const unarchiveRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listId}/unarchive`,
        headers: authHeader(cookie),
      });
      expect(unarchiveRes.statusCode).toBe(200);

      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      expect(boardBody.board.lists).toHaveLength(1);
    });
  });
});
