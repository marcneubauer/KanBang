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

async function addChecklistWithItem(
  app: FastifyInstance,
  cookie: string,
  cardId: string,
  name = 'Steps',
) {
  const clRes = await app.inject({
    method: 'POST',
    url: `/api/v1/cards/${cardId}/checklists`,
    headers: authHeader(cookie),
    payload: { name },
  });
  const { checklist } = JSON.parse(clRes.body);
  await app.inject({
    method: 'POST',
    url: `/api/v1/checklists/${checklist.id}/items`,
    headers: authHeader(cookie),
    payload: { title: 'step one' },
  });
  return checklist;
}

async function addLabelToCard(
  app: FastifyInstance,
  cookie: string,
  boardId: string,
  cardId: string,
) {
  const labelRes = await app.inject({
    method: 'POST',
    url: `/api/v1/boards/${boardId}/labels`,
    headers: authHeader(cookie),
    payload: { name: 'urgent', color: '#eb5a46' },
  });
  const { label } = JSON.parse(labelRes.body);
  await app.inject({
    method: 'POST',
    url: `/api/v1/cards/${cardId}/labels/${label.id}`,
    headers: authHeader(cookie),
  });
  return label;
}

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

    it('defaults completed to false on new cards', async () => {
      const { body } = await createCard(app, cookie, listId, 'New Task');
      expect(body.card.completed).toBe(false);
    });

    it('updates card completed status to true', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Task');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.completed).toBe(true);
    });

    it('toggles card completed status back to false', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Task');
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: false },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.completed).toBe(false);
    });

    it('includes completed in board fetch response', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Task');
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
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
      expect(card.completed).toBe(true);
    });
  });

  describe('GET /api/v1/cards/:cardId', () => {
    it('returns a single card', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'My Task', 'Details');
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.id).toBe(cardBody.card.id);
      expect(body.card.title).toBe('My Task');
      expect(body.card.description).toBe('Details');
      expect(body.card.listId).toBe(listId);
      expect(body.card.completed).toBe(false);
    });

    it('returns 404 for non-existent card', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cards/nonexistent',
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns 404 for another user card', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Private');
      const { sessionCookie: otherCookie } = await registerUser(app, {
        email: 'other@example.com',
        username: 'other',
      });
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(otherCookie!),
      });
      expect(response.statusCode).toBe(403);
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

  describe('GET /api/v1/boards/:boardId/cards/search', () => {
    it('returns all cards when no filters', async () => {
      await createCard(app, cookie, listId, 'Task A');
      await createCard(app, cookie, listId, 'Task B');
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}/cards/search`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.cards).toHaveLength(2);
    });

    it('searches by text in title', async () => {
      await createCard(app, cookie, listId, 'Deploy to prod');
      await createCard(app, cookie, listId, 'Write tests');
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}/cards/search?q=deploy`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(body.cards).toHaveLength(1);
      expect(body.cards[0].title).toBe('Deploy to prod');
    });

    it('searches by text in description', async () => {
      await createCard(app, cookie, listId, 'Task', 'Fix the login bug');
      await createCard(app, cookie, listId, 'Other', 'Update readme');
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}/cards/search?q=login`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(body.cards).toHaveLength(1);
      expect(body.cards[0].description).toBe('Fix the login bug');
    });

    it('filters by completed status', async () => {
      const { body: c1 } = await createCard(app, cookie, listId, 'Done task');
      await createCard(app, cookie, listId, 'Open task');
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${c1.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}/cards/search?completed=true`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(body.cards).toHaveLength(1);
      expect(body.cards[0].title).toBe('Done task');
    });

    it('combines text and completed filters', async () => {
      const { body: c1 } = await createCard(app, cookie, listId, 'Deploy v1');
      await createCard(app, cookie, listId, 'Deploy v2');
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${c1.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}/cards/search?q=deploy&completed=false`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(body.cards).toHaveLength(1);
      expect(body.cards[0].title).toBe('Deploy v2');
    });

    it('returns empty array when no matches', async () => {
      await createCard(app, cookie, listId, 'Task');
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}/cards/search?q=nonexistent`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(body.cards).toHaveLength(0);
    });

    it('includes listName in results', async () => {
      await createCard(app, cookie, listId, 'Task');
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}/cards/search`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(body.cards[0].listName).toBe('To Do');
    });

    it('returns 404 for non-existent board', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/boards/nonexistent/cards/search',
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('due dates', () => {
    it('creates card without due date defaults to null', async () => {
      const { body } = await createCard(app, cookie, listId, 'No Due');
      expect(body.card.dueDate).toBeNull();
    });

    it('creates card with due date', async () => {
      const dueDate = '2026-04-15T12:00:00.000Z';
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/lists/${listId}/cards`,
        headers: authHeader(cookie),
        payload: { title: 'With Due', dueDate },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(201);
      expect(body.card.dueDate).toBe(dueDate);
    });

    it('updates card to set due date', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Task');
      const dueDate = '2026-05-01T09:00:00.000Z';
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { dueDate },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.dueDate).toBe(dueDate);
    });

    it('updates card to clear due date', async () => {
      const dueDate = '2026-05-01T09:00:00.000Z';
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lists/${listId}/cards`,
        headers: authHeader(cookie),
        payload: { title: 'Has Due', dueDate },
      });
      const cardId = JSON.parse(createRes.body).card.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}`,
        headers: authHeader(cookie),
        payload: { dueDate: null },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.dueDate).toBeNull();
    });

    it('includes dueDate in board detail response', async () => {
      const dueDate = '2026-06-01T00:00:00.000Z';
      await app.inject({
        method: 'POST',
        url: `/api/v1/lists/${listId}/cards`,
        headers: authHeader(cookie),
        payload: { title: 'Due Card', dueDate },
      });
      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      const card = boardBody.board.lists[0].cards[0];
      expect(card.dueDate).toBe(dueDate);
    });

    it('includes dueDate in single card response', async () => {
      const dueDate = '2026-07-04T18:00:00.000Z';
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lists/${listId}/cards`,
        headers: authHeader(cookie),
        payload: { title: 'Independence', dueDate },
      });
      const cardId = JSON.parse(createRes.body).card.id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${cardId}`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(body.card.dueDate).toBe(dueDate);
    });
  });

  describe('PATCH /api/v1/cards/:cardId/archive', () => {
    it('archives a card and removes it from active list view', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'To Archive');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}/archive`,
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });

      // Card no longer appears in board active view
      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      expect(boardBody.board.lists[0].cards).toHaveLength(0);
    });

    it('unarchives a card and restores it to active list view', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'To Restore');
      const cardId = cardBody.card.id;

      await app.inject({ method: 'PATCH', url: `/api/v1/cards/${cardId}/archive`, headers: authHeader(cookie) });

      const unarchiveRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}/unarchive`,
        headers: authHeader(cookie),
      });
      expect(unarchiveRes.statusCode).toBe(200);

      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      expect(boardBody.board.lists[0].cards).toHaveLength(1);
    });

    it('returns 404 for non-existent card', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/cards/nonexistent/archive',
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/cards/:cardId/copy', () => {
    it('copies a card with checklists and labels to another list on the same board', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Original', 'desc');
      const cardId = cardBody.card.id;
      await addChecklistWithItem(app, cookie, cardId);
      await addLabelToCard(app, cookie, boardId, cardId);
      const { body: otherList } = await createList(app, cookie, boardId, 'Doing');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardId}/copy`,
        headers: authHeader(cookie),
        payload: { listId: otherList.list.id },
      });
      expect(res.statusCode).toBe(201);
      const { card: copy } = JSON.parse(res.body);
      expect(copy.title).toBe('Original');
      expect(copy.description).toBe('desc');
      expect(copy.listId).toBe(otherList.list.id);
      expect(copy.id).not.toBe(cardId);

      // Copy has its own checklists and labels
      const clRes = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${copy.id}/checklists`,
        headers: authHeader(cookie),
      });
      const { checklists } = JSON.parse(clRes.body);
      expect(checklists).toHaveLength(1);
      expect(checklists[0].items).toHaveLength(1);

      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const board = JSON.parse(boardRes.body).board;
      const copiedCard = board.lists
        .flatMap((l: { cards: Array<{ id: string; labelIds: string[] }> }) => l.cards)
        .find((c: { id: string }) => c.id === copy.id);
      expect(copiedCard.labelIds).toHaveLength(1);
    });

    it('omits checklists when keepChecklists is false', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Original');
      await addChecklistWithItem(app, cookie, cardBody.card.id);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardBody.card.id}/copy`,
        headers: authHeader(cookie),
        payload: { listId, keepChecklists: false },
      });
      const { card: copy } = JSON.parse(res.body);

      const clRes = await app.inject({
        method: 'GET',
        url: `/api/v1/cards/${copy.id}/checklists`,
        headers: authHeader(cookie),
      });
      expect(JSON.parse(clRes.body).checklists).toHaveLength(0);
    });

    it('copies to another board without labels (board-scoped)', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Cross-board');
      await addLabelToCard(app, cookie, boardId, cardBody.card.id);

      const { body: otherBoard } = await createBoard(app, cookie, 'Second Board');
      const { body: otherList } = await createList(app, cookie, otherBoard.board.id, 'Inbox');

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardBody.card.id}/copy`,
        headers: authHeader(cookie),
        payload: { listId: otherList.list.id, keepLabels: true },
      });
      expect(res.statusCode).toBe(201);
      const { card: copy } = JSON.parse(res.body);

      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${otherBoard.board.id}`,
        headers: authHeader(cookie),
      });
      const board = JSON.parse(boardRes.body).board;
      const copiedCard = board.lists[0].cards.find((c: { id: string }) => c.id === copy.id);
      expect(copiedCard.labelIds).toHaveLength(0);
    });

    it("rejects copying to another user's list", async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Mine');
      const { sessionCookie: otherCookie } = await registerUser(app, {
        email: 'other@example.com',
        username: 'otheruser',
      });
      const { body: otherBoard } = await createBoard(app, otherCookie!, 'Their Board');
      const { body: otherList } = await createList(app, otherCookie!, otherBoard.board.id);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardBody.card.id}/copy`,
        headers: authHeader(cookie),
        payload: { listId: otherList.list.id },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('cross-board move', () => {
    it('moves a card to another board and drops its label assignments', async () => {
      const { body: cardBody } = await createCard(app, cookie, listId, 'Mover');
      const cardId = cardBody.card.id;
      await addLabelToCard(app, cookie, boardId, cardId);

      const { body: otherBoard } = await createBoard(app, cookie, 'Second Board');
      const { body: otherList } = await createList(app, cookie, otherBoard.board.id, 'Inbox');

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardId}/move`,
        headers: authHeader(cookie),
        payload: { listId: otherList.list.id, position: 'n' },
      });
      expect(res.statusCode).toBe(200);

      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${otherBoard.board.id}`,
        headers: authHeader(cookie),
      });
      const board = JSON.parse(boardRes.body).board;
      const moved = board.lists[0].cards.find((c: { id: string }) => c.id === cardId);
      expect(moved).toBeDefined();
      expect(moved.labelIds).toHaveLength(0);
    });
  });
});
