import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  createTestApp,
  registerUser,
  authHeader,
  createBoard,
  createList,
  createCard,
} from './helpers.js';
import { cards } from '../../src/db/schema.js';

describe('Done column', () => {
  let app: FastifyInstance;
  let cookie: string;
  let boardId: string;

  beforeEach(async () => {
    app = await createTestApp();
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;
    const { body: boardBody } = await createBoard(app, cookie, 'Test Board');
    boardId = boardBody.board.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('PATCH /api/v1/lists/:listId/done', () => {
    it('designates a list as Done', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'Done');
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.list.isDone).toBe(true);
    });

    it('only one Done list per board — designating another clears the first', async () => {
      const { body: list1Body } = await createList(app, cookie, boardId, 'Done 1');
      const { body: list2Body } = await createList(app, cookie, boardId, 'Done 2');

      // Designate first list as Done
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${list1Body.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });

      // Designate second list as Done
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${list2Body.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.list.isDone).toBe(true);

      // Verify first list is no longer Done via board detail
      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);
      const list1 = boardBody.board.lists.find((l: { id: string }) => l.id === list1Body.list.id);
      const list2 = boardBody.board.lists.find((l: { id: string }) => l.id === list2Body.list.id);
      expect(list1.isDone).toBe(false);
      expect(list2.isDone).toBe(true);
    });

    it('removes Done status from a list', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'Done');

      // Set as Done
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });

      // Remove Done status
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: false },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.list.isDone).toBe(false);
    });
  });

  describe('Card completion auto-move', () => {
    it('marks card complete and auto-moves to Done list', async () => {
      const { body: todoBody } = await createList(app, cookie, boardId, 'To Do');
      const { body: doneBody } = await createList(app, cookie, boardId, 'Done');

      // Designate Done list
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${doneBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });

      // Create card in To Do
      const { body: cardBody } = await createCard(app, cookie, todoBody.list.id, 'My Task');

      // Mark complete
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.completed).toBe(true);
      expect(body.card.listId).toBe(doneBody.list.id);
      expect(body.card.completedAt).toBeDefined();
      expect(body.card.completedAt).not.toBeNull();
    });

    it('marks card incomplete — stays in Done list, completedAt cleared', async () => {
      const { body: todoBody } = await createList(app, cookie, boardId, 'To Do');
      const { body: doneBody } = await createList(app, cookie, boardId, 'Done');

      // Designate Done list
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${doneBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });

      // Create card, mark complete (auto-moves to Done list)
      const { body: cardBody } = await createCard(app, cookie, todoBody.list.id, 'My Task');
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });

      // Mark incomplete
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: false },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.completed).toBe(false);
      expect(body.card.completedAt).toBeNull();
      // Card stays in the Done list — no auto-move back
      expect(body.card.listId).toBe(doneBody.list.id);
    });

    it('marks card complete with no Done list — stays in place, completedAt set', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'To Do');
      const { body: cardBody } = await createCard(app, cookie, listBody.list.id, 'My Task');

      // No Done list designated — mark complete
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.card.completed).toBe(true);
      expect(body.card.completedAt).toBeDefined();
      expect(body.card.completedAt).not.toBeNull();
      // Card stays in original list
      expect(body.card.listId).toBe(listBody.list.id);
    });
  });

  describe('Board detail response', () => {
    it('includes isDone on lists and completedAt on cards', async () => {
      const { body: todoBody } = await createList(app, cookie, boardId, 'To Do');
      const { body: doneBody } = await createList(app, cookie, boardId, 'Done');

      // Designate Done list
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${doneBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });

      // Create a card and mark it complete
      const { body: cardBody } = await createCard(app, cookie, todoBody.list.id, 'Task');
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });

      // Fetch board detail
      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);

      // Check isDone on lists
      const todoList = boardBody.board.lists.find((l: { id: string }) => l.id === todoBody.list.id);
      const doneList = boardBody.board.lists.find((l: { id: string }) => l.id === doneBody.list.id);
      expect(todoList.isDone).toBe(false);
      expect(doneList.isDone).toBe(true);

      // Card should be in the Done list with completedAt
      const card = doneList.cards.find((c: { id: string }) => c.id === cardBody.card.id);
      expect(card).toBeDefined();
      expect(card.completed).toBe(true);
      expect(card.completedAt).toBeDefined();
      expect(card.completedAt).not.toBeNull();
    });
  });

  describe('Auto-archive', () => {
    it('archives cards completed 3+ days ago in Done list on board fetch', async () => {
      const { body: doneBody } = await createList(app, cookie, boardId, 'Done');

      // Designate Done list
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${doneBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });

      // Create a card directly in the Done list and mark complete
      const { body: cardBody } = await createCard(app, cookie, doneBody.list.id, 'Old Task');
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${cardBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });

      // Manipulate completedAt directly via DB to 4 days ago
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      await app.db
        .update(cards)
        .set({ completedAt: fourDaysAgo })
        .where(eq(cards.id, cardBody.card.id));

      // Also create a recent completed card that should NOT be archived
      const { body: recentBody } = await createCard(app, cookie, doneBody.list.id, 'Recent Task');
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/cards/${recentBody.card.id}`,
        headers: authHeader(cookie),
        payload: { completed: true },
      });

      // Fetch board detail — triggers auto-archive
      const boardRes = await app.inject({
        method: 'GET',
        url: `/api/v1/boards/${boardId}`,
        headers: authHeader(cookie),
      });
      const boardBody = JSON.parse(boardRes.body);

      const doneList = boardBody.board.lists.find((l: { id: string }) => l.id === doneBody.list.id);

      // Old task should be archived (not in active cards)
      const oldCard = doneList.cards.find((c: { id: string }) => c.id === cardBody.card.id);
      expect(oldCard).toBeUndefined();

      // Recent task should still be present
      const recentCard = doneList.cards.find((c: { id: string }) => c.id === recentBody.card.id);
      expect(recentCard).toBeDefined();
    });
  });

  describe('Done list archive protection', () => {
    it('cannot archive Done list while isDone = true', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'Done');

      // Designate as Done
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });

      // Try to archive
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/archive`,
        headers: authHeader(cookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.code).toBe('DONE_LIST_ARCHIVE');
      expect(body.error).toBe('Remove Done status before archiving');
    });

    it('can archive list after removing Done status', async () => {
      const { body: listBody } = await createList(app, cookie, boardId, 'Done');

      // Designate as Done then remove
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: true },
      });
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/done`,
        headers: authHeader(cookie),
        payload: { isDone: false },
      });

      // Archive should succeed
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lists/${listBody.list.id}/archive`,
        headers: authHeader(cookie),
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ ok: true });
    });
  });
});
