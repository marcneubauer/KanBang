import type { FastifyInstance } from 'fastify';
import { CardService } from '../../services/card.service.js';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import {
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
} from '@kanbang/shared/validation/card.js';

export default async function cardRoutes(fastify: FastifyInstance) {
  const cardService = new CardService(fastify.db);
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  async function verifyListOwnership(listId: string, userId: string): Promise<boolean> {
    const boardId = await listService.getBoardId(listId);
    if (!boardId) return false;
    return boardService.isOwner(boardId, userId);
  }

  async function verifyCardOwnership(cardId: string, userId: string): Promise<boolean> {
    const listId = await cardService.getListId(cardId);
    if (!listId) return false;
    return verifyListOwnership(listId, userId);
  }

  // GET /api/v1/cards/:cardId
  fastify.get<{ Params: { cardId: string } }>('/cards/:cardId', async (request, reply) => {
    const { cardId } = request.params;

    if (!(await verifyCardOwnership(cardId, request.user!.id))) {
      return reply.code(404).send({ error: 'Card not found', code: 'NOT_FOUND' });
    }

    const card = await cardService.getById(cardId);
    return { card };
  });

  // POST /api/v1/lists/:listId/cards
  fastify.post<{ Params: { listId: string } }>(
    '/lists/:listId/cards',
    async (request, reply) => {
      const { listId } = request.params;

      if (!(await verifyListOwnership(listId, request.user!.id))) {
        return reply.code(404).send({ error: 'List not found', code: 'NOT_FOUND' });
      }

      const parsed = createCardSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const card = await cardService.create(listId, parsed.data);
      return reply.code(201).send({ card });
    },
  );

  // PATCH /api/v1/cards/:cardId
  fastify.patch<{ Params: { cardId: string } }>('/cards/:cardId', async (request, reply) => {
    const { cardId } = request.params;

    if (!(await verifyCardOwnership(cardId, request.user!.id))) {
      return reply.code(404).send({ error: 'Card not found', code: 'NOT_FOUND' });
    }

    const parsed = updateCardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const card = await cardService.update(cardId, parsed.data);
    return { card };
  });

  // PATCH /api/v1/cards/:cardId/move
  fastify.patch<{ Params: { cardId: string } }>(
    '/cards/:cardId/move',
    async (request, reply) => {
      const { cardId } = request.params;

      if (!(await verifyCardOwnership(cardId, request.user!.id))) {
        return reply.code(404).send({ error: 'Card not found', code: 'NOT_FOUND' });
      }

      const parsed = moveCardSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      // Verify target list ownership
      if (!(await verifyListOwnership(parsed.data.listId, request.user!.id))) {
        return reply.code(404).send({ error: 'Target list not found', code: 'NOT_FOUND' });
      }

      const card = await cardService.move(cardId, parsed.data.listId, parsed.data.position);
      return { card };
    },
  );

  // DELETE /api/v1/cards/:cardId
  fastify.delete<{ Params: { cardId: string } }>('/cards/:cardId', async (request, reply) => {
    const { cardId } = request.params;

    if (!(await verifyCardOwnership(cardId, request.user!.id))) {
      return reply.code(404).send({ error: 'Card not found', code: 'NOT_FOUND' });
    }

    await cardService.delete(cardId);
    return { ok: true };
  });
}
