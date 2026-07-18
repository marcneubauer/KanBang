import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, registerUser, authHeader } from './helpers.js';

const trelloExport = {
  name: 'My Trello Board',
  desc: 'ignored board field',
  lists: [
    { id: 'tl2', name: 'Doing', closed: false, pos: 2000 },
    { id: 'tl1', name: 'To Do', closed: false, pos: 1000 },
    { id: 'tl3', name: 'Old Stuff', closed: true, pos: 3000 },
  ],
  labels: [
    { id: 'lab1', name: 'urgent', color: 'red' },
    { id: 'lab2', name: '', color: 'green' }, // unnamed + unused → skipped
    { id: 'lab3', name: '', color: 'sky' }, // unnamed but used → imported
    { id: 'lab4', name: 'weird', color: 'green_dark' },
  ],
  cards: [
    {
      id: 'tc2',
      name: 'Second card',
      desc: '',
      idList: 'tl1',
      pos: 200,
      closed: false,
      due: null,
      dueComplete: false,
      idLabels: ['lab3'],
    },
    {
      id: 'tc1',
      name: 'First card',
      desc: 'with description',
      idList: 'tl1',
      pos: 100,
      closed: false,
      due: '2026-08-01T12:00:00.000Z',
      dueComplete: true,
      idLabels: ['lab1', 'lab4'],
    },
    {
      id: 'tc3',
      name: 'Archived card',
      desc: '',
      idList: 'tl2',
      pos: 50,
      closed: true,
      due: null,
      dueComplete: false,
      idLabels: [],
    },
    {
      id: 'tc4',
      name: 'Orphan card',
      desc: '',
      idList: 'unknown-list',
      pos: 1,
      closed: false,
      due: null,
      dueComplete: false,
      idLabels: [],
    },
  ],
  checklists: [
    {
      id: 'chk1',
      name: 'Steps',
      idCard: 'tc1',
      pos: 1,
      checkItems: [
        { id: 'ci2', name: 'step two', state: 'incomplete', pos: 2 },
        { id: 'ci1', name: 'step one', state: 'complete', pos: 1 },
      ],
    },
    { id: 'chk2', name: 'Orphan checklist', idCard: 'tc4', pos: 1, checkItems: [] },
  ],
};

async function importBoard(app: FastifyInstance, cookie: string, payload: unknown) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/import/trello',
    headers: authHeader(cookie),
    payload: payload as Record<string, unknown>,
  });
  return { response, body: JSON.parse(response.body) };
}

describe('Trello import', () => {
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

  it('requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/import/trello',
      payload: trelloExport,
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects payloads that are not a Trello export', async () => {
    const { response, body } = await importBoard(app, cookie, { foo: 'bar' });
    expect(response.statusCode).toBe(400);
    expect(body.code).toBe('INVALID_TRELLO_EXPORT');
  });

  it('imports the board with a correct summary', async () => {
    const { response, body } = await importBoard(app, cookie, trelloExport);
    expect(response.statusCode).toBe(201);
    expect(body.summary.boardName).toBe('My Trello Board');
    expect(body.summary.lists).toBe(3);
    expect(body.summary.cards).toBe(3); // orphan card skipped
    expect(body.summary.labels).toBe(3); // unnamed+unused label skipped
    expect(body.summary.checklists).toBe(1); // orphan checklist skipped
    expect(body.summary.checklistItems).toBe(2);
  });

  it('preserves list order, card order, and card fields', async () => {
    const { body } = await importBoard(app, cookie, trelloExport);

    const boardRes = await app.inject({
      method: 'GET',
      url: `/api/v1/boards/${body.summary.boardId}`,
      headers: authHeader(cookie),
    });
    const { board } = JSON.parse(boardRes.body);

    // Closed list is archived, so only the two open lists appear, pos-sorted
    expect(board.lists.map((l: { name: string }) => l.name)).toEqual(['To Do', 'Doing']);

    const todo = board.lists[0];
    expect(todo.cards.map((c: { title: string }) => c.title)).toEqual([
      'First card',
      'Second card',
    ]);

    const first = todo.cards[0];
    expect(first.description).toBe('with description');
    expect(first.completed).toBe(true);
    expect(first.dueDate).toContain('2026-08-01');
    expect(first.labelIds).toHaveLength(2);
    expect(first.checklistProgress.total).toBe(2);
    expect(first.checklistProgress.completed).toBe(1);

    // Doing list: its only card is archived
    expect(board.lists[1].cards).toHaveLength(0);
  });

  it('maps Trello label colors onto the KanBang palette', async () => {
    const { body } = await importBoard(app, cookie, trelloExport);

    const labelsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/boards/${body.summary.boardId}/labels`,
      headers: authHeader(cookie),
    });
    const { labels } = JSON.parse(labelsRes.body);

    const byName = new Map(labels.map((l: { name: string; color: string }) => [l.name, l.color]));
    expect(byName.get('urgent')).toBe('#eb5a46');
    expect(byName.get('weird')).toBe('#61bd4f'); // green_dark → green
    expect(byName.get('')).toBe('#00c2e0'); // sky
  });

  it('imports archived items as archived', async () => {
    const { body } = await importBoard(app, cookie, trelloExport);

    const archivedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/boards/${body.summary.boardId}/archived`,
      headers: authHeader(cookie),
    });
    const archived = JSON.parse(archivedRes.body);
    expect(archived.archivedLists.map((l: { name: string }) => l.name)).toEqual(['Old Stuff']);
    expect(archived.archivedCards.map((c: { title: string }) => c.title)).toEqual(['Archived card']);
  });
});
