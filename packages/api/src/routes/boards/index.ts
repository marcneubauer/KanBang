import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { BoardService } from '../../services/board.service.js';
import { CardService } from '../../services/card.service.js';
import { createBoardSchema, updateBoardSchema } from '@kanbang/shared/validation/board.js';
import { searchCardsSchema } from '@kanbang/shared/validation/card.js';
import { validateBody } from '../../utils/validate.js';
import { verifyBoardOwnership } from '../../utils/ownership.js';

export default async function boardRoutes(fastify: FastifyInstance) {
  const boardService = new BoardService(fastify.db);
  const cardService = new CardService(fastify.db);

  // All board routes require auth
  fastify.addHook('preHandler', fastify.requireAuth);

  // GET /api/v1/boards
  fastify.get<{ Querystring: { archived?: string } }>('/', async (request) => {
    const { user } = request as AuthenticatedRequest;
    const archived = request.query.archived === 'true';
    const boards = await boardService.getAll(user.id, archived);
    return { boards };
  });

  // POST /api/v1/boards
  fastify.post('/', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const data = await validateBody(createBoardSchema, request.body, reply);
    if (!data) return;

    const board = await boardService.create(user.id, data);
    return reply.code(201).send({ board });
  });

  // GET /api/v1/boards/:boardId
  fastify.get<{ Params: { boardId: string } }>('/:boardId', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    const board = await boardService.getById(boardId);
    if (!board) {
      return reply.code(404).send({ error: 'Board not found', code: 'NOT_FOUND' });
    }
    if (board.userId !== user.id) {
      return reply.code(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    return { board };
  });

  // GET /api/v1/boards/:boardId/archived
  fastify.get<{ Params: { boardId: string } }>('/:boardId/archived', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    if (!(await verifyBoardOwnership(boardId, user.id, boardService, reply))) return;

    const result = await boardService.getArchivedItems(boardId);
    return result;
  });

  // GET /api/v1/boards/:boardId/cards/search
  fastify.get<{ Params: { boardId: string }; Querystring: Record<string, string> }>(
    '/:boardId/cards/search',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { boardId } = request.params;

      if (!(await verifyBoardOwnership(boardId, user.id, boardService, reply))) return;

      const data = await validateBody(searchCardsSchema, request.query, reply);
      if (!data) return;

      const cards = await cardService.search(boardId, data);
      return { cards };
    },
  );

  // PATCH /api/v1/boards/:boardId
  fastify.patch<{ Params: { boardId: string } }>('/:boardId', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    if (!(await verifyBoardOwnership(boardId, user.id, boardService, reply))) return;

    const data = await validateBody(updateBoardSchema, request.body, reply);
    if (!data) return;

    const board = await boardService.update(boardId, data);
    return { board };
  });

  // PATCH /api/v1/boards/:boardId/archive
  fastify.patch<{ Params: { boardId: string } }>('/:boardId/archive', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    if (!(await verifyBoardOwnership(boardId, user.id, boardService, reply))) return;

    await boardService.archive(boardId);
    return { ok: true };
  });

  // PATCH /api/v1/boards/:boardId/unarchive
  fastify.patch<{ Params: { boardId: string } }>(
    '/:boardId/unarchive',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { boardId } = request.params;

      if (!(await verifyBoardOwnership(boardId, user.id, boardService, reply))) return;

      await boardService.unarchive(boardId);
      return { ok: true };
    },
  );
}
