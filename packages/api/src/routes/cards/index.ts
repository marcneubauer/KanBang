import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { CardService } from '../../services/card.service.js';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import { AttachmentService } from '../../services/attachment.service.js';
import {
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
  copyCardSchema,
} from '@kanbang/shared/validation/card.js';
import { validateBody } from '../../utils/validate.js';
import { verifyListOwnership, verifyCardOwnership as verifyCardOwnershipUtil } from '../../utils/ownership.js';

const cardResponse200 = {
  type: 'object',
  properties: { card: { $ref: 'card#' } },
} as const;

const cardResponse201 = {
  type: 'object',
  properties: { card: { $ref: 'card#' } },
} as const;

const okResponse = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
} as const;

export default async function cardRoutes(fastify: FastifyInstance) {
  const cardService = new CardService(fastify.db);
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);
  const attachmentService = new AttachmentService(fastify.db);
  cardService.setListService(listService);

  fastify.addHook('preHandler', fastify.requireAuth);

  const verifyCardOwnership = (cardId: string, userId: string) =>
    verifyCardOwnershipUtil(cardId, userId, cardService, listService, boardService);

  // GET /api/v1/cards/:cardId
  fastify.get<{ Params: { cardId: string } }>('/cards/:cardId', {
    schema: {
      response: {
        200: cardResponse200,
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { cardId } = request.params;

    await verifyCardOwnership(cardId, user.id);

    const card = await cardService.getById(cardId);
    return { card };
  });

  // POST /api/v1/lists/:listId/cards
  fastify.post<{ Params: { listId: string } }>(
    '/lists/:listId/cards',
    {
      schema: {
        response: {
          201: cardResponse201,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      await verifyListOwnership(listId, user.id, listService, boardService);

      const data = await validateBody(createCardSchema, request.body, reply);
      if (!data) return;

      const card = await cardService.create(listId, data);
      return reply.code(201).send({ card });
    },
  );

  // PATCH /api/v1/cards/:cardId
  fastify.patch<{ Params: { cardId: string } }>('/cards/:cardId', {
    schema: {
      response: {
        200: cardResponse200,
      },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { cardId } = request.params;

    await verifyCardOwnership(cardId, user.id);

    const data = await validateBody(updateCardSchema, request.body, reply);
    if (!data) return;

    // Attachment covers must point at an attachment on this card
    if (data.coverType === 'attachment') {
      const attachment = await attachmentService.get(data.coverValue!);
      if (!attachment || attachment.cardId !== cardId) {
        return reply.code(400).send({
          error: 'coverValue must be the id of an attachment on this card',
          code: 'INVALID_COVER',
        });
      }
    }

    const card = await cardService.update(cardId, data);
    return { card };
  });

  // PATCH /api/v1/cards/:cardId/move
  fastify.patch<{ Params: { cardId: string } }>(
    '/cards/:cardId/move',
    {
      schema: {
        response: {
          200: cardResponse200,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      await verifyCardOwnership(cardId, user.id);

      const data = await validateBody(moveCardSchema, request.body, reply);
      if (!data) return;

      // Verify target list ownership
      await verifyListOwnership(data.listId, user.id, listService, boardService);

      const card = await cardService.move(cardId, data.listId, data.position);
      return { card };
    },
  );

  // POST /api/v1/cards/:cardId/copy
  fastify.post<{ Params: { cardId: string } }>(
    '/cards/:cardId/copy',
    {
      schema: {
        response: {
          201: cardResponse201,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      await verifyCardOwnership(cardId, user.id);

      const data = await validateBody(copyCardSchema, request.body, reply);
      if (!data) return;

      // Verify target list ownership (may be on a different board)
      await verifyListOwnership(data.listId, user.id, listService, boardService);

      const card = await cardService.copy(cardId, data);
      return reply.code(201).send({ card });
    },
  );

  // PATCH /api/v1/cards/:cardId/archive
  fastify.patch<{ Params: { cardId: string } }>(
    '/cards/:cardId/archive',
    {
      schema: {
        response: {
          200: okResponse,
        },
      },
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      await verifyCardOwnership(cardId, user.id);

      await cardService.archive(cardId);
      return { ok: true };
    },
  );

  // PATCH /api/v1/cards/:cardId/unarchive
  fastify.patch<{ Params: { cardId: string } }>(
    '/cards/:cardId/unarchive',
    {
      schema: {
        response: {
          200: okResponse,
        },
      },
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      await verifyCardOwnership(cardId, user.id);

      await cardService.unarchive(cardId);
      return { ok: true };
    },
  );
}
