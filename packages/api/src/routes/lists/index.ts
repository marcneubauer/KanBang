import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import {
  createListSchema,
  updateListSchema,
  reorderListSchema,
  setDoneListSchema,
  sortListSchema,
} from '@kanbang/shared/validation/list.js';
import { validateBody } from '../../utils/validate.js';
import { verifyBoardOwnership, verifyListOwnership } from '../../utils/ownership.js';

const listResponse200 = {
  type: 'object',
  properties: { list: { $ref: 'list#' } },
} as const;

const listResponse201 = {
  type: 'object',
  properties: { list: { $ref: 'list#' } },
} as const;

const okResponse = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
} as const;

// List with nested cards (returned by GET /lists/:listId)
const listWithCardsResponse = {
  type: 'object',
  properties: {
    list: {
      type: 'object',
      properties: {
        id:         { type: 'string' },
        name:       { type: 'string' },
        boardId:    { type: 'string' },
        position:   { type: 'string' },
        isDone:     { type: 'boolean' },
        cardLimit:  { type: ['number', 'null'] },
        createdAt:  { type: 'string' },
        updatedAt:  { type: 'string' },
        archivedAt: { type: ['string', 'null'] },
        cards:      { type: 'array', items: { $ref: 'card#' } },
      },
    },
  },
} as const;

export default async function listRoutes(fastify: FastifyInstance) {
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  // GET /api/v1/lists/:listId
  fastify.get<{ Params: { listId: string } }>('/lists/:listId', {
    schema: {
      response: {
        200: listWithCardsResponse,
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { listId } = request.params;

    await verifyListOwnership(listId, user.id, listService, boardService);

    const list = await listService.getByIdWithCards(listId);
    return { list };
  });

  // POST /api/v1/boards/:boardId/lists
  fastify.post<{ Params: { boardId: string } }>(
    '/boards/:boardId/lists',
    {
      schema: {
        response: {
          201: listResponse201,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { boardId } = request.params;

      await verifyBoardOwnership(boardId, user.id, boardService);

      const data = await validateBody(createListSchema, request.body, reply);
      if (!data) return;

      const list = await listService.create(boardId, data);
      return reply.code(201).send({ list });
    },
  );

  // PATCH /api/v1/lists/:listId
  fastify.patch<{ Params: { listId: string } }>('/lists/:listId', {
    schema: {
      response: {
        200: listResponse200,
      },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { listId } = request.params;

    await verifyListOwnership(listId, user.id, listService, boardService);

    const data = await validateBody(updateListSchema, request.body, reply);
    if (!data) return;

    const list = await listService.update(listId, data);
    return { list };
  });

  // PATCH /api/v1/lists/:listId/reorder
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/reorder',
    {
      schema: {
        response: {
          200: listResponse200,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      await verifyListOwnership(listId, user.id, listService, boardService);

      const data = await validateBody(reorderListSchema, request.body, reply);
      if (!data) return;

      const list = await listService.reorder(listId, data.position);
      return { list };
    },
  );

  // PATCH /api/v1/lists/:listId/sort
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/sort',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              cards: { type: 'array', items: { $ref: 'card#' } },
            },
          } as const,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      await verifyListOwnership(listId, user.id, listService, boardService);

      const data = await validateBody(sortListSchema, request.body, reply);
      if (!data) return;

      const cards = await listService.sortCards(listId, data);
      return { cards };
    },
  );

  // PATCH /api/v1/lists/:listId/done
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/done',
    {
      schema: {
        response: {
          200: listResponse200,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      await verifyListOwnership(listId, user.id, listService, boardService);

      const data = await validateBody(setDoneListSchema, request.body, reply);
      if (!data) return;

      const list = await listService.setDone(listId, data.isDone);
      if (!list) {
        return reply.code(404).send({ error: 'List not found', code: 'NOT_FOUND' });
      }
      return { list };
    },
  );

  // PATCH /api/v1/lists/:listId/archive
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/archive',
    {
      schema: {
        response: {
          200: okResponse,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      await verifyListOwnership(listId, user.id, listService, boardService);

      const result = await listService.archive(listId);
      if (!result.ok) {
        return reply.code(400).send({ error: result.error, code: 'DONE_LIST_ARCHIVE' });
      }
      return { ok: true };
    },
  );

  // PATCH /api/v1/lists/:listId/unarchive
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/unarchive',
    {
      schema: {
        response: {
          200: okResponse,
        },
      },
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      await verifyListOwnership(listId, user.id, listService, boardService);

      await listService.unarchive(listId);
      return { ok: true };
    },
  );
}
