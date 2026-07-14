import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { LabelService } from '../../services/label.service.js';
import { BoardService } from '../../services/board.service.js';
import { ListService } from '../../services/list.service.js';
import { CardService } from '../../services/card.service.js';
import { createLabelSchema, updateLabelSchema } from '@kanbang/shared/validation/label.js';
import { validateBody } from '../../utils/validate.js';
import { verifyBoardOwnership, verifyCardOwnership } from '../../utils/ownership.js';

const okResponse = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
} as const;

const labelResponse = {
  type: 'object',
  properties: { label: { $ref: 'label#' } },
} as const;

export default async function labelRoutes(fastify: FastifyInstance) {
  const labelService = new LabelService(fastify.db);
  const boardService = new BoardService(fastify.db);
  const listService = new ListService(fastify.db);
  const cardService = new CardService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  async function verifyLabelOwnership(labelId: string, userId: string): Promise<void> {
    const boardId = await labelService.getBoardId(labelId);
    if (!boardId) throw fastify.httpErrors.notFound('Label not found');
    await verifyBoardOwnership(boardId, userId, boardService);
  }

  /** Verify the user owns the card and the label, and both are on the same board. */
  async function verifyCardLabelOwnership(cardId: string, labelId: string, userId: string) {
    await verifyCardOwnership(cardId, userId, cardService, listService, boardService);
    const labelBoardId = await labelService.getBoardId(labelId);
    if (!labelBoardId) throw fastify.httpErrors.notFound('Label not found');
    const listId = await cardService.getListId(cardId);
    const cardBoardId = listId ? await listService.getBoardId(listId) : null;
    if (labelBoardId !== cardBoardId) {
      throw fastify.httpErrors.notFound('Label not found');
    }
  }

  // GET /api/v1/boards/:boardId/labels
  fastify.get<{ Params: { boardId: string } }>('/boards/:boardId/labels', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: { labels: { type: 'array', items: { $ref: 'label#' } } },
        },
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    await verifyBoardOwnership(boardId, user.id, boardService);

    const labels = await labelService.getByBoard(boardId);
    return { labels };
  });

  // POST /api/v1/boards/:boardId/labels
  fastify.post<{ Params: { boardId: string } }>('/boards/:boardId/labels', {
    schema: {
      response: {
        201: labelResponse,
      },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { boardId } = request.params;

    await verifyBoardOwnership(boardId, user.id, boardService);

    const data = await validateBody(createLabelSchema, request.body, reply);
    if (!data) return;

    const label = await labelService.create(boardId, data);
    return reply.code(201).send({ label });
  });

  // PATCH /api/v1/labels/:labelId
  fastify.patch<{ Params: { labelId: string } }>('/labels/:labelId', {
    schema: {
      response: {
        200: labelResponse,
      },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { labelId } = request.params;

    await verifyLabelOwnership(labelId, user.id);

    const data = await validateBody(updateLabelSchema, request.body, reply);
    if (!data) return;

    const label = await labelService.update(labelId, data);
    return { label };
  });

  // DELETE /api/v1/labels/:labelId
  fastify.delete<{ Params: { labelId: string } }>('/labels/:labelId', {
    schema: {
      response: {
        200: okResponse,
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { labelId } = request.params;

    await verifyLabelOwnership(labelId, user.id);

    await labelService.delete(labelId);
    return { ok: true };
  });

  // POST /api/v1/cards/:cardId/labels/:labelId
  fastify.post<{ Params: { cardId: string; labelId: string } }>('/cards/:cardId/labels/:labelId', {
    schema: {
      response: {
        200: okResponse,
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { cardId, labelId } = request.params;

    await verifyCardLabelOwnership(cardId, labelId, user.id);

    await labelService.addToCard(cardId, labelId);
    return { ok: true };
  });

  // DELETE /api/v1/cards/:cardId/labels/:labelId
  fastify.delete<{ Params: { cardId: string; labelId: string } }>('/cards/:cardId/labels/:labelId', {
    schema: {
      response: {
        200: okResponse,
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { cardId, labelId } = request.params;

    await verifyCardLabelOwnership(cardId, labelId, user.id);

    await labelService.removeFromCard(cardId, labelId);
    return { ok: true };
  });
}
