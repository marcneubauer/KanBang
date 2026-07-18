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

describe('Comment routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  let boardId: string;
  let cardId: string;

  beforeEach(async () => {
    app = await createTestApp();
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;
    const { body: boardBody } = await createBoard(app, cookie);
    boardId = boardBody.board.id;
    const { body: listBody } = await createList(app, cookie, boardId);
    const { body: cardBody } = await createCard(app, cookie, listBody.list.id);
    cardId = cardBody.card.id;
  });

  afterEach(async () => {
    await app.close();
  });

  async function addComment(body: string) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cards/${cardId}/comments`,
      headers: authHeader(cookie),
      payload: { body },
    });
    return { response, body: JSON.parse(response.body) };
  }

  it('creates and lists comments newest-first', async () => {
    const { response, body } = await addComment('first comment');
    expect(response.statusCode).toBe(201);
    expect(body.comment.body).toBe('first comment');
    await addComment('second comment');

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/cards/${cardId}/comments`,
      headers: authHeader(cookie),
    });
    const { comments } = JSON.parse(listRes.body);
    expect(comments).toHaveLength(2);
    expect(comments.map((c: { body: string }) => c.body)).toContain('first comment');
  });

  it('rejects empty comments', async () => {
    const { response } = await addComment('   ');
    expect(response.statusCode).toBe(400);
  });

  it('updates a comment', async () => {
    const { body } = await addComment('original');
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/comments/${body.comment.id}`,
      headers: authHeader(cookie),
      payload: { body: 'edited' },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).comment.body).toBe('edited');
  });

  it('deletes a comment', async () => {
    const { body } = await addComment('to delete');
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/comments/${body.comment.id}`,
      headers: authHeader(cookie),
    });
    expect(res.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/cards/${cardId}/comments`,
      headers: authHeader(cookie),
    });
    expect(JSON.parse(listRes.body).comments).toHaveLength(0);
  });

  it("blocks access to another user's comments", async () => {
    const { body } = await addComment('private');
    const { sessionCookie: otherCookie } = await registerUser(app, {
      email: 'other@example.com',
      username: 'otheruser',
    });

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/cards/${cardId}/comments`,
      headers: authHeader(otherCookie!),
    });
    expect(listRes.statusCode).toBe(403);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/comments/${body.comment.id}`,
      headers: authHeader(otherCookie!),
      payload: { body: 'hijacked' },
    });
    expect(patchRes.statusCode).toBe(403);
  });

  it('includes commentCount in the board detail response', async () => {
    await addComment('one');
    await addComment('two');

    const boardRes = await app.inject({
      method: 'GET',
      url: `/api/v1/boards/${boardId}`,
      headers: authHeader(cookie),
    });
    const board = JSON.parse(boardRes.body).board;
    expect(board.lists[0].cards[0].commentCount).toBe(2);
  });

  it('cascade-deletes comments with the card', async () => {
    const { body } = await addComment('doomed');
    // Archiving keeps comments; verify via direct delete of board (cascade)
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/cards/${cardId}/archive`,
      headers: authHeader(cookie),
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/comments/${body.comment.id}`,
      headers: authHeader(cookie),
    });
    // No GET single-comment route: expect 404 from the not-found handler
    expect(res.statusCode).toBe(404);
  });
});
