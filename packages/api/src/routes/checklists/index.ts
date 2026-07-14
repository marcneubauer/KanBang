import type { FastifyInstance } from 'fastify';
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
import { verifyListOwnership, verifyCardOwnership as verifyCardOwnershipUtil } from '../../utils/ownership.js';

// Checklist with nested items (returned by create and list endpoints)
const checklistWithItemsSchema = {
  type: 'object',
  properties: {
    id:          { type: 'string' },
    name:        { type: 'string' },
    cardId:      { type: 'string' },
    position:    { type: 'string' },
    createdAt:   { type: 'string' },
    updatedAt:   { type: 'string' },
    items:       { type: 'array', items: { $ref: 'checklistItem#' } },
  },
} as const;

const checklistResponse200 = {
  type: 'object',
  properties: { checklist: { $ref: 'checklist#' } },
} as const;

// Create returns checklist with items: []
const checklistResponse201 = {
  type: 'object',
  properties: { checklist: checklistWithItemsSchema },
} as const;

const itemResponse200 = {
  type: 'object',
  properties: { item: { $ref: 'checklistItem#' } },
} as const;

const itemResponse201 = {
  type: 'object',
  properties: { item: { $ref: 'checklistItem#' } },
} as const;

const okResponse = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
} as const;

const cardResponse201 = {
  type: 'object',
  properties: { card: { $ref: 'card#' } },
} as const;

export default async function checklistRoutes(fastify: FastifyInstance) {
  const checklistService = new ChecklistService(fastify.db);
  const checklistItemService = new ChecklistItemService(fastify.db);
  const cardService = new CardService(fastify.db);
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  const verifyCardOwnership = (cardId: string, userId: string) =>
    verifyCardOwnershipUtil(cardId, userId, cardService, listService, boardService);

  async function verifyChecklistOwnership(checklistId: string, userId: string): Promise<void> {
    const cardId = await checklistService.getCardId(checklistId);
    if (!cardId) throw fastify.httpErrors.notFound('Checklist not found');
    await verifyCardOwnership(cardId, userId);
  }

  async function verifyChecklistItemOwnership(itemId: string, userId: string): Promise<void> {
    const checklistId = await checklistItemService.getChecklistId(itemId);
    if (!checklistId) throw fastify.httpErrors.notFound('Checklist item not found');
    await verifyChecklistOwnership(checklistId, userId);
  }

  // GET /api/v1/cards/:cardId/checklists
  fastify.get<{ Params: { cardId: string } }>(
    '/cards/:cardId/checklists',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { checklists: { type: 'array', items: checklistWithItemsSchema } },
          },
        },
      },
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      await verifyCardOwnership(cardId, user.id);

      const checklists = await checklistService.getByCardId(cardId);
      return { checklists };
    },
  );

  // POST /api/v1/cards/:cardId/checklists
  fastify.post<{ Params: { cardId: string } }>(
    '/cards/:cardId/checklists',
    {
      schema: {
        response: {
          201: checklistResponse201,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      await verifyCardOwnership(cardId, user.id);

      const data = await validateBody(createChecklistSchema, request.body, reply);
      if (!data) return;

      const checklist = await checklistService.create(cardId, data);
      return reply.code(201).send({ checklist });
    },
  );

  // PATCH /api/v1/checklists/:checklistId
  fastify.patch<{ Params: { checklistId: string } }>(
    '/checklists/:checklistId',
    {
      schema: {
        response: {
          200: checklistResponse200,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { checklistId } = request.params;

      await verifyChecklistOwnership(checklistId, user.id);

      const data = await validateBody(updateChecklistSchema, request.body, reply);
      if (!data) return;

      const checklist = await checklistService.update(checklistId, data);
      return { checklist };
    },
  );

  // PATCH /api/v1/checklists/:checklistId/reorder
  fastify.patch<{ Params: { checklistId: string } }>(
    '/checklists/:checklistId/reorder',
    {
      schema: {
        response: {
          200: checklistResponse200,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { checklistId } = request.params;

      await verifyChecklistOwnership(checklistId, user.id);

      const data = await validateBody(reorderChecklistSchema, request.body, reply);
      if (!data) return;

      const checklist = await checklistService.reorder(checklistId, data.position);
      return { checklist };
    },
  );

  // DELETE /api/v1/checklists/:checklistId
  fastify.delete<{ Params: { checklistId: string } }>(
    '/checklists/:checklistId',
    {
      schema: {
        response: {
          200: okResponse,
        },
      },
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const { checklistId } = request.params;

      await verifyChecklistOwnership(checklistId, user.id);

      await checklistService.delete(checklistId);
      return { ok: true };
    },
  );

  // POST /api/v1/checklists/:checklistId/items
  fastify.post<{ Params: { checklistId: string } }>(
    '/checklists/:checklistId/items',
    {
      schema: {
        response: {
          201: itemResponse201,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { checklistId } = request.params;

      await verifyChecklistOwnership(checklistId, user.id);

      const data = await validateBody(createChecklistItemSchema, request.body, reply);
      if (!data) return;

      const item = await checklistItemService.create(checklistId, data);
      return reply.code(201).send({ item });
    },
  );

  // PATCH /api/v1/checklist-items/:itemId
  fastify.patch<{ Params: { itemId: string } }>(
    '/checklist-items/:itemId',
    {
      schema: {
        response: {
          200: itemResponse200,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { itemId } = request.params;

      await verifyChecklistItemOwnership(itemId, user.id);

      const data = await validateBody(updateChecklistItemSchema, request.body, reply);
      if (!data) return;

      const item = await checklistItemService.update(itemId, data);
      return { item };
    },
  );

  // PATCH /api/v1/checklist-items/:itemId/reorder
  fastify.patch<{ Params: { itemId: string } }>(
    '/checklist-items/:itemId/reorder',
    {
      schema: {
        response: {
          200: itemResponse200,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { itemId } = request.params;

      await verifyChecklistItemOwnership(itemId, user.id);

      const data = await validateBody(reorderChecklistItemSchema, request.body, reply);
      if (!data) return;

      const item = await checklistItemService.reorder(itemId, data.position);
      return { item };
    },
  );

  // DELETE /api/v1/checklist-items/:itemId
  fastify.delete<{ Params: { itemId: string } }>(
    '/checklist-items/:itemId',
    {
      schema: {
        response: {
          200: okResponse,
        },
      },
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const { itemId } = request.params;

      await verifyChecklistItemOwnership(itemId, user.id);

      await checklistItemService.delete(itemId);
      return { ok: true };
    },
  );

  // POST /api/v1/checklist-items/:itemId/convert-to-card
  fastify.post<{ Params: { itemId: string } }>(
    '/checklist-items/:itemId/convert-to-card',
    {
      schema: {
        response: {
          201: cardResponse201,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { itemId } = request.params;

      await verifyChecklistItemOwnership(itemId, user.id);

      const data = await validateBody(convertToCardSchema, request.body, reply);
      if (!data) return;

      // Verify target list ownership
      await verifyListOwnership(data.listId, user.id, listService, boardService);

      const card = await checklistItemService.convertToCard(itemId, data.listId);
      if (!card) {
        reply.code(404).send({ error: 'Checklist item not found', code: 'NOT_FOUND' });
        return;
      }

      return reply.code(201).send({ card });
    },
  );
}
