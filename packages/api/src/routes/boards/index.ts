import type { FastifyInstance } from 'fastify';
import { BoardService } from '../../services/board.service.js';
import { CardService } from '../../services/card.service.js';
import { createBoardSchema, updateBoardSchema } from '@kanbang/shared/validation/board.js';
import { searchCardsSchema } from '@kanbang/shared/validation/card.js';

export default async function boardRoutes(fastify: FastifyInstance) {
  const boardService = new BoardService(fastify.db);
  const cardService = new CardService(fastify.db);

  // All board routes require auth
  fastify.addHook('preHandler', fastify.requireAuth);

  // GET /api/v1/boards
  fastify.get('/', async (request) => {
    const boards = await boardService.getAll(request.user!.id);
    return { boards };
  });

  // POST /api/v1/boards
  fastify.post('/', async (request, reply) => {
    const parsed = createBoardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const board = await boardService.create(request.user!.id, parsed.data);
    return reply.code(201).send({ board });
  });

  // GET /api/v1/boards/:boardId
  fastify.get<{ Params: { boardId: string } }>('/:boardId', async (request, reply) => {
    const { boardId } = request.params;

    const board = await boardService.getById(boardId);
    if (!board) {
      return reply.code(404).send({ error: 'Board not found', code: 'NOT_FOUND' });
    }
    if (board.userId !== request.user!.id) {
      return reply.code(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
    }

    return { board };
  });

  // GET /api/v1/boards/:boardId/cards/search
  fastify.get<{ Params: { boardId: string }; Querystring: Record<string, string> }>(
    '/:boardId/cards/search',
    async (request, reply) => {
      const { boardId } = request.params;

      if (!(await boardService.isOwner(boardId, request.user!.id))) {
        return reply.code(404).send({ error: 'Board not found', code: 'NOT_FOUND' });
      }

      const parsed = searchCardsSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const cards = await cardService.search(boardId, parsed.data);
      return { cards };
    },
  );

  // PATCH /api/v1/boards/:boardId
  fastify.patch<{ Params: { boardId: string } }>('/:boardId', async (request, reply) => {
    const { boardId } = request.params;

    if (!(await boardService.isOwner(boardId, request.user!.id))) {
      return reply.code(404).send({ error: 'Board not found', code: 'NOT_FOUND' });
    }

    const parsed = updateBoardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const board = await boardService.update(boardId, parsed.data);
    return { board };
  });

  // DELETE /api/v1/boards/:boardId
  fastify.delete<{ Params: { boardId: string } }>('/:boardId', async (request, reply) => {
    const { boardId } = request.params;

    if (!(await boardService.isOwner(boardId, request.user!.id))) {
      return reply.code(404).send({ error: 'Board not found', code: 'NOT_FOUND' });
    }

    await boardService.delete(boardId);
    return { ok: true };
  });
}
