import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { CardService } from '../../services/card.service.js';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import {
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
} from '@kanbang/shared/validation/card.js';
import { validateBody } from '../../utils/validate.js';
import { verifyListOwnership } from '../../utils/ownership.js';

export default async function cardRoutes(fastify: FastifyInstance) {
  const cardService = new CardService(fastify.db);
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);
  cardService.setListService(listService);

  fastify.addHook('preHandler', fastify.requireAuth);

  async function verifyCardOwnership(
    cardId: string,
    userId: string,
    reply: FastifyReply,
  ): Promise<boolean> {
    const listId = await cardService.getListId(cardId);
    if (!listId) {
      reply.code(404).send({ error: 'Card not found', code: 'NOT_FOUND' });
      return false;
    }
    const boardId = await listService.getBoardId(listId);
    if (!boardId) {
      reply.code(404).send({ error: 'Card not found', code: 'NOT_FOUND' });
      return false;
    }
    const board = await boardService.getById(boardId);
    if (!board) {
      reply.code(404).send({ error: 'Card not found', code: 'NOT_FOUND' });
      return false;
    }
    if (board.userId !== userId) {
      reply.code(403).send({ error: 'Forbidden', code: 'FORBIDDEN' });
      return false;
    }
    return true;
  }

  // GET /api/v1/cards/:cardId
  fastify.get<{ Params: { cardId: string } }>('/cards/:cardId', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { cardId } = request.params;

    if (!(await verifyCardOwnership(cardId, user.id, reply))) return;

    const card = await cardService.getById(cardId);
    return { card };
  });

  // POST /api/v1/lists/:listId/cards
  fastify.post<{ Params: { listId: string } }>(
    '/lists/:listId/cards',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      if (!(await verifyListOwnership(listId, user.id, listService, boardService, reply))) return;

      const data = await validateBody(createCardSchema, request.body, reply);
      if (!data) return;

      const card = await cardService.create(listId, data);
      return reply.code(201).send({ card });
    },
  );

  // PATCH /api/v1/cards/:cardId
  fastify.patch<{ Params: { cardId: string } }>('/cards/:cardId', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { cardId } = request.params;

    if (!(await verifyCardOwnership(cardId, user.id, reply))) return;

    const data = await validateBody(updateCardSchema, request.body, reply);
    if (!data) return;

    const card = await cardService.update(cardId, data);
    return { card };
  });

  // PATCH /api/v1/cards/:cardId/move
  fastify.patch<{ Params: { cardId: string } }>(
    '/cards/:cardId/move',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      if (!(await verifyCardOwnership(cardId, user.id, reply))) return;

      const data = await validateBody(moveCardSchema, request.body, reply);
      if (!data) return;

      // Verify target list ownership
      if (!(await verifyListOwnership(data.listId, user.id, listService, boardService, reply)))
        return;

      const card = await cardService.move(cardId, data.listId, data.position);
      return { card };
    },
  );

  // PATCH /api/v1/cards/:cardId/archive
  fastify.patch<{ Params: { cardId: string } }>(
    '/cards/:cardId/archive',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      if (!(await verifyCardOwnership(cardId, user.id, reply))) return;

      await cardService.archive(cardId);
      return { ok: true };
    },
  );

  // PATCH /api/v1/cards/:cardId/unarchive
  fastify.patch<{ Params: { cardId: string } }>(
    '/cards/:cardId/unarchive',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      if (!(await verifyCardOwnership(cardId, user.id, reply))) return;

      await cardService.unarchive(cardId);
      return { ok: true };
    },
  );
}
