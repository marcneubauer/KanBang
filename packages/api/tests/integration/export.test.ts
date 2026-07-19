import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, registerUser, authHeader } from './helpers.js';

describe('Export route', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  async function createBoardWithData(sessionCookie: string) {
    const boardRes = await app.inject({
      method: 'POST',
      url: '/api/v1/boards',
      headers: authHeader(sessionCookie),
      payload: { name: 'My Board' },
    });
    const { board } = JSON.parse(boardRes.body);

    const listRes = await app.inject({
      method: 'POST',
      url: `/api/v1/boards/${board.id}/lists`,
      headers: authHeader(sessionCookie),
      payload: { name: 'Todo' },
    });
    const { list } = JSON.parse(listRes.body);

    const cardRes = await app.inject({
      method: 'POST',
      url: `/api/v1/lists/${list.id}/cards`,
      headers: authHeader(sessionCookie),
      payload: { title: 'A card' },
    });
    const { card } = JSON.parse(cardRes.body);

    const checklistRes = await app.inject({
      method: 'POST',
      url: `/api/v1/cards/${card.id}/checklists`,
      headers: authHeader(sessionCookie),
      payload: { name: 'Steps' },
    });
    const { checklist } = JSON.parse(checklistRes.body);

    await app.inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items`,
      headers: authHeader(sessionCookie),
      payload: { title: 'Step one' },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/cards/${card.id}/comments`,
      headers: authHeader(sessionCookie),
      payload: { body: 'A comment' },
    });

    return { board, list, card, checklist };
  }

  it('exports the full nested structure with a download header', async () => {
    const { sessionCookie, body: registerBody } = await registerUser(app);
    const { board, list, card, checklist } = await createBoardWithData(sessionCookie!);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/export',
      headers: authHeader(sessionCookie!),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toMatch(
      /^attachment; filename="kanbang-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );

    const data = JSON.parse(response.body);
    expect(data.exportedAt).toBeDefined();
    expect(data.user.id).toBe(registerBody.user.id);
    expect(data.boards).toHaveLength(1);
    expect(data.boards[0].id).toBe(board.id);
    expect(data.boards[0].lists).toHaveLength(1);
    expect(data.boards[0].lists[0].id).toBe(list.id);
    expect(data.boards[0].lists[0].cards).toHaveLength(1);
    expect(data.boards[0].lists[0].cards[0].id).toBe(card.id);
    expect(data.boards[0].lists[0].cards[0].checklists).toHaveLength(1);
    expect(data.boards[0].lists[0].cards[0].checklists[0].id).toBe(checklist.id);
    expect(data.boards[0].lists[0].cards[0].checklists[0].items).toHaveLength(1);
    expect(data.boards[0].lists[0].cards[0].checklists[0].items[0].title).toBe('Step one');
    expect(data.boards[0].lists[0].cards[0].comments).toHaveLength(1);
    expect(data.boards[0].lists[0].cards[0].comments[0].body).toBe('A comment');
  });

  it('includes archived items', async () => {
    const { sessionCookie } = await registerUser(app);
    const { card } = await createBoardWithData(sessionCookie!);

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/cards/${card.id}/archive`,
      headers: authHeader(sessionCookie!),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/export',
      headers: authHeader(sessionCookie!),
    });

    const data = JSON.parse(response.body);
    expect(data.boards[0].lists[0].cards).toHaveLength(1);
    expect(data.boards[0].lists[0].cards[0].archivedAt).not.toBeNull();
  });

  it('does not include other users data', async () => {
    const owner = await registerUser(app);
    await createBoardWithData(owner.sessionCookie!);

    const other = await registerUser(app, {
      email: 'other@example.com',
      username: 'otheruser',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/export',
      headers: authHeader(other.sessionCookie!),
    });

    const data = JSON.parse(response.body);
    expect(data.boards).toHaveLength(0);
    expect(data.user.email).toBe('other@example.com');
  });

  it('returns 401 when not authenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/export',
    });
    expect(response.statusCode).toBe(401);
  });
});
