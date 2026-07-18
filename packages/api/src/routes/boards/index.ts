import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { BoardService } from '../../services/board.service.js';
import { CardService } from '../../services/card.service.js';
import { createBoardSchema, updateBoardSchema } from '@kanbang/shared/validation/board.js';
import { searchCardsSchema } from '@kanbang/shared/validation/card.js';
import { validateBody } from '../../utils/validate.js';
import { verifyBoardOwnership } from '../../utils/ownership.js';

const okResponse = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
} as const;

// Card with checklist progress (returned inside the full board detail)
const cardWithProgressSchema = {
  type: 'object',
  properties: {
    id:          { type: 'string' },
    title:       { type: 'string' },
    description: { type: ['string', 'null'] },
    listId:      { type: 'string' },
    position:    { type: 'string' },
    completed:   { type: 'boolean' },
    completedAt: { type: ['string', 'null'] },
    dueDate:     { type: ['string', 'null'] },
    createdAt:   { type: 'string' },
    updatedAt:   { type: 'string' },
    archivedAt:  { type: ['string', 'null'] },
    checklistProgress: {
      type: 'object',
      properties: {
        total:     { type: 'number' },
        completed: { type: 'number' },
      },
    },
    labelIds: { type: 'array', items: { type: 'string' } },
  },
} as const;

// List with nested cards (returned inside board detail)
const listWithCardsSchema = {
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
    cards:      { type: 'array', items: cardWithProgressSchema },
  },
} as const;

// Archived card row (subset of card fields with listName)
const archivedCardRowSchema = {
  type: 'object',
  properties: {
    id:         { type: 'string' },
    title:      { type: 'string' },
    completed:  { type: 'boolean' },
    listId:     { type: 'string' },
    listName:   { type: 'string' },
    position:   { type: 'string' },
    archivedAt: { type: ['string', 'null'] },
  },
} as const;

// Archived list with all its cards
const archivedListWithCardsSchema = {
  type: 'object',
  properties: {
    id:         { type: 'string' },
    name:       { type: 'string' },
    boardId:    { type: 'string' },
    position:   { type: 'string' },
    isDone:     { type: 'boolean' },
    createdAt:  { type: 'string' },
    updatedAt:  { type: 'string' },
    archivedAt: { type: ['string', 'null'] },
    cards:      { type: 'array', items: { $ref: 'card#' } },
  },
} as const;

export default async function boardRoutes(fastify: FastifyInstance) {
  const boardService = new BoardService(fastify.db);
  const cardService = new CardService(fastify.db);

  // All board routes require auth
  fastify.addHook('preHandler', fastify.requireAuth);

  // GET /api/v1/boards
  fastify.get<{ Querystring: { archived?: string } }>('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: { boards: { type: 'array', items: { $ref: 'board#' } } },
        },
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const archived = request.query.archived === 'true';
    const boards = await boardService.getAll(user.id, archived);
    return { boards };
  });

  // POST /api/v1/boards
  fastify.post('/', {
    schema: {
      response: {
        201: {
          type: 'object',
          properties: { board: { $ref: 'board#' } },
        },
      },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const data = await validateBody(createBoardSchema, request.body, reply);
    if (!data) return;

    const board = await boardService.create(user.id, data);
    return reply.code(201).send({ board });
  });

  // GET /api/v1/boards/:boardId
  fastify.get<{ Params: { boardId: string } }>('/:boardId', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            board: {
              type: 'object',
              properties: {
                id:            { type: 'string' },
                name:          { type: 'string' },
                userId:        { type: 'string' },
                cardAgingDays: { type: ['number', 'null'] },
                createdAt:     { type: 'string' },
                updatedAt:     { type: 'string' },
                archivedAt:    { type: ['string', 'null'] },
                lists:         { type: 'array', items: listWithCardsSchema },
                labels:        { type: 'array', items: { $ref: 'label#' } },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    await verifyBoardOwnership(boardId, user.id, boardService);
    await boardService.archiveStaleDoneCards(boardId);

    const board = await boardService.getById(boardId);
    if (!board) {
      return reply.code(404).send({ error: 'Board not found', code: 'NOT_FOUND' });
    }

    return { board };
  });

  // GET /api/v1/boards/:boardId/archived
  fastify.get<{ Params: { boardId: string } }>('/:boardId/archived', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            archivedLists: { type: 'array', items: archivedListWithCardsSchema },
            archivedCards: { type: 'array', items: archivedCardRowSchema },
          },
        },
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    await verifyBoardOwnership(boardId, user.id, boardService);

    const result = await boardService.getArchivedItems(boardId);
    return result;
  });

  // GET /api/v1/boards/:boardId/cards/search
  // Note: search returns a custom projection with listName but without archivedAt/completedAt
  const cardSearchResultSchema = {
    type: 'object',
    properties: {
      id:          { type: 'string' },
      title:       { type: 'string' },
      description: { type: ['string', 'null'] },
      listId:      { type: 'string' },
      listName:    { type: 'string' },
      position:    { type: 'string' },
      completed:   { type: 'boolean' },
      dueDate:     { type: ['string', 'null'] },
      createdAt:   { type: 'string' },
      updatedAt:   { type: 'string' },
    },
  } as const;

  fastify.get<{ Params: { boardId: string }; Querystring: Record<string, string> }>(
    '/:boardId/cards/search',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { cards: { type: 'array', items: cardSearchResultSchema } },
          },
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { boardId } = request.params;

      await verifyBoardOwnership(boardId, user.id, boardService);

      const data = await validateBody(searchCardsSchema, request.query, reply);
      if (!data) return;

      const cards = await cardService.search(boardId, data);
      return { cards };
    },
  );

  // PATCH /api/v1/boards/:boardId
  fastify.patch<{ Params: { boardId: string } }>('/:boardId', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: { board: { $ref: 'board#' } },
        },
      },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    await verifyBoardOwnership(boardId, user.id, boardService);

    const data = await validateBody(updateBoardSchema, request.body, reply);
    if (!data) return;

    const board = await boardService.update(boardId, data);
    return { board };
  });

  // PATCH /api/v1/boards/:boardId/archive
  fastify.patch<{ Params: { boardId: string } }>('/:boardId/archive', {
    schema: {
      response: {
        200: okResponse,
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    await verifyBoardOwnership(boardId, user.id, boardService);

    await boardService.archive(boardId);
    return { ok: true };
  });

  // PATCH /api/v1/boards/:boardId/unarchive
  fastify.patch<{ Params: { boardId: string } }>(
    '/:boardId/unarchive',
    {
      schema: {
        response: {
          200: okResponse,
        },
      },
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const { boardId } = request.params;

      await verifyBoardOwnership(boardId, user.id, boardService);

      await boardService.unarchive(boardId);
      return { ok: true };
    },
  );
}
