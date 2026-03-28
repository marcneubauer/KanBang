import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { ChecklistService } from '../../services/checklist.service.js';
import { ChecklistItemService } from '../../services/checklist-item.service.js';
import { CardService } from '../../services/card.service.js';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import {
  createChecklistSchema,
  updateChecklistSchema,
  reorderChecklistSchema,
  createChecklistItemSchema,
  updateChecklistItemSchema,
  reorderChecklistItemSchema,
  convertToCardSchema,
} from '@kanbang/shared/validation/checklist.js';
import { validateBody } from '../../utils/validate.js';
import { verifyListOwnership } from '../../utils/ownership.js';

export default async function checklistRoutes(fastify: FastifyInstance) {
  const checklistService = new ChecklistService(fastify.db);
  const checklistItemService = new ChecklistItemService(fastify.db);
  const cardService = new CardService(fastify.db);
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);

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

  async function verifyChecklistOwnership(
    checklistId: string,
    userId: string,
    reply: FastifyReply,
  ): Promise<boolean> {
    const cardId = await checklistService.getCardId(checklistId);
    if (!cardId) {
      reply.code(404).send({ error: 'Checklist not found', code: 'NOT_FOUND' });
      return false;
    }
    return verifyCardOwnership(cardId, userId, reply);
  }

  async function verifyChecklistItemOwnership(
    itemId: string,
    userId: string,
    reply: FastifyReply,
  ): Promise<boolean> {
    const checklistId = await checklistItemService.getChecklistId(itemId);
    if (!checklistId) {
      reply.code(404).send({ error: 'Checklist item not found', code: 'NOT_FOUND' });
      return false;
    }
    return verifyChecklistOwnership(checklistId, userId, reply);
  }

  // GET /api/v1/cards/:cardId/checklists
  fastify.get<{ Params: { cardId: string } }>(
    '/cards/:cardId/checklists',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      if (!(await verifyCardOwnership(cardId, user.id, reply))) return;

      const checklists = await checklistService.getByCardId(cardId);
      return { checklists };
    },
  );

  // POST /api/v1/cards/:cardId/checklists
  fastify.post<{ Params: { cardId: string } }>(
    '/cards/:cardId/checklists',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      if (!(await verifyCardOwnership(cardId, user.id, reply))) return;

      const data = await validateBody(createChecklistSchema, request.body, reply);
      if (!data) return;

      const checklist = await checklistService.create(cardId, data);
      return reply.code(201).send({ checklist });
    },
  );

  // PATCH /api/v1/checklists/:checklistId
  fastify.patch<{ Params: { checklistId: string } }>(
    '/checklists/:checklistId',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { checklistId } = request.params;

      if (!(await verifyChecklistOwnership(checklistId, user.id, reply))) return;

      const data = await validateBody(updateChecklistSchema, request.body, reply);
      if (!data) return;

      const checklist = await checklistService.update(checklistId, data);
      return { checklist };
    },
  );

  // PATCH /api/v1/checklists/:checklistId/reorder
  fastify.patch<{ Params: { checklistId: string } }>(
    '/checklists/:checklistId/reorder',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { checklistId } = request.params;

      if (!(await verifyChecklistOwnership(checklistId, user.id, reply))) return;

      const data = await validateBody(reorderChecklistSchema, request.body, reply);
      if (!data) return;

      const checklist = await checklistService.reorder(checklistId, data.position);
      return { checklist };
    },
  );

  // DELETE /api/v1/checklists/:checklistId
  fastify.delete<{ Params: { checklistId: string } }>(
    '/checklists/:checklistId',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { checklistId } = request.params;

      if (!(await verifyChecklistOwnership(checklistId, user.id, reply))) return;

      await checklistService.delete(checklistId);
      return { ok: true };
    },
  );

  // POST /api/v1/checklists/:checklistId/items
  fastify.post<{ Params: { checklistId: string } }>(
    '/checklists/:checklistId/items',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { checklistId } = request.params;

      if (!(await verifyChecklistOwnership(checklistId, user.id, reply))) return;

      const data = await validateBody(createChecklistItemSchema, request.body, reply);
      if (!data) return;

      const item = await checklistItemService.create(checklistId, data);
      return reply.code(201).send({ item });
    },
  );

  // PATCH /api/v1/checklist-items/:itemId
  fastify.patch<{ Params: { itemId: string } }>(
    '/checklist-items/:itemId',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { itemId } = request.params;

      if (!(await verifyChecklistItemOwnership(itemId, user.id, reply))) return;

      const data = await validateBody(updateChecklistItemSchema, request.body, reply);
      if (!data) return;

      const item = await checklistItemService.update(itemId, data);
      return { item };
    },
  );

  // PATCH /api/v1/checklist-items/:itemId/reorder
  fastify.patch<{ Params: { itemId: string } }>(
    '/checklist-items/:itemId/reorder',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { itemId } = request.params;

      if (!(await verifyChecklistItemOwnership(itemId, user.id, reply))) return;

      const data = await validateBody(reorderChecklistItemSchema, request.body, reply);
      if (!data) return;

      const item = await checklistItemService.reorder(itemId, data.position);
      return { item };
    },
  );

  // DELETE /api/v1/checklist-items/:itemId
  fastify.delete<{ Params: { itemId: string } }>(
    '/checklist-items/:itemId',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { itemId } = request.params;

      if (!(await verifyChecklistItemOwnership(itemId, user.id, reply))) return;

      await checklistItemService.delete(itemId);
      return { ok: true };
    },
  );

  // POST /api/v1/checklist-items/:itemId/convert-to-card
  fastify.post<{ Params: { itemId: string } }>(
    '/checklist-items/:itemId/convert-to-card',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { itemId } = request.params;

      if (!(await verifyChecklistItemOwnership(itemId, user.id, reply))) return;

      const data = await validateBody(convertToCardSchema, request.body, reply);
      if (!data) return;

      // Verify target list ownership
      if (!(await verifyListOwnership(data.listId, user.id, listService, boardService, reply)))
        return;

      const card = await checklistItemService.convertToCard(itemId, data.listId);
      if (!card) {
        reply.code(404).send({ error: 'Checklist item not found', code: 'NOT_FOUND' });
        return;
      }

      return reply.code(201).send({ card });
    },
  );
}
