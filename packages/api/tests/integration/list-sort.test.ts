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

async function sortList(
  app: FastifyInstance,
  cookie: string,
  listId: string,
  payload: { by: string; direction?: string },
) {
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/v1/lists/${listId}/sort`,
    headers: authHeader(cookie),
    payload,
  });
  return { response, body: JSON.parse(response.body) };
}

describe('List sort', () => {
  let app: FastifyInstance;
  let cookie: string;
  let listId: string;

  beforeEach(async () => {
    app = await createTestApp();
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;
    const { body: boardBody } = await createBoard(app, cookie);
    const { body: listBody } = await createList(app, cookie, boardBody.board.id);
    listId = listBody.list.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('sorts by name ascending and descending', async () => {
    await createCard(app, cookie, listId, 'banana');
    await createCard(app, cookie, listId, 'Apple');
    await createCard(app, cookie, listId, 'cherry');

    const { response, body } = await sortList(app, cookie, listId, { by: 'name' });
    expect(response.statusCode).toBe(200);
    expect(body.cards.map((c: { title: string }) => c.title)).toEqual([
      'Apple',
      'banana',
      'cherry',
    ]);

    const { body: descBody } = await sortList(app, cookie, listId, {
      by: 'name',
      direction: 'desc',
    });
    expect(descBody.cards.map((c: { title: string }) => c.title)).toEqual([
      'cherry',
      'banana',
      'Apple',
    ]);
  });

  it('sorts by due date with undated cards last', async () => {
    const { body: noDue } = await createCard(app, cookie, listId, 'no due');
    const { body: late } = await createCard(app, cookie, listId, 'late');
    const { body: early } = await createCard(app, cookie, listId, 'early');

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/cards/${late.card.id}`,
      headers: authHeader(cookie),
      payload: { dueDate: '2026-12-01T00:00:00.000Z' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/cards/${early.card.id}`,
      headers: authHeader(cookie),
      payload: { dueDate: '2026-08-01T00:00:00.000Z' },
    });

    const { body } = await sortList(app, cookie, listId, { by: 'dueDate' });
    expect(body.cards.map((c: { title: string }) => c.title)).toEqual([
      'early',
      'late',
      'no due',
    ]);
    expect(noDue.card.id).toBeDefined();
  });

  it('persists the new order', async () => {
    await createCard(app, cookie, listId, 'b');
    await createCard(app, cookie, listId, 'a');
    await sortList(app, cookie, listId, { by: 'name' });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/lists/${listId}`,
      headers: authHeader(cookie),
    });
    const { list } = JSON.parse(res.body);
    expect(list.cards.map((c: { title: string }) => c.title)).toEqual(['a', 'b']);
  });

  it('rejects an unknown sort key', async () => {
    const { response } = await sortList(app, cookie, listId, { by: 'position' });
    expect(response.statusCode).toBe(400);
  });

  it("rejects sorting another user's list", async () => {
    const { sessionCookie: otherCookie } = await registerUser(app, {
      email: 'other@example.com',
      username: 'otheruser',
    });

    const { response } = await sortList(app, otherCookie!, listId, { by: 'name' });
    expect(response.statusCode).toBe(403);
  });
});
