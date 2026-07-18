import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { QuickAddService } from '../../services/quick-add.service.js';
import { CardService } from '../../services/card.service.js';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import { quickAddSchema, quickAddConfigSchema } from '@kanbang/shared/validation/quick-add.js';
import { validateBody } from '../../utils/validate.js';
import { verifyListOwnership } from '../../utils/ownership.js';

const quickAddResponse201 = {
  type: 'object',
  properties: {
    card: { $ref: 'card#' },
    board: { type: 'string' },
    list: { type: 'string' },
  },
} as const;

const configResponse = {
  type: 'object',
  properties: {
    list: {
      type: ['object', 'null'],
      properties: {
        listId: { type: 'string' },
        listName: { type: 'string' },
        boardId: { type: 'string' },
        boardName: { type: 'string' },
      },
    },
    token: {
      type: ['object', 'null'],
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
        lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
      },
    },
  },
} as const;

const tokenResponse201 = {
  type: 'object',
  properties: { token: { type: 'string' } },
} as const;

const okResponse = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
} as const;

const errorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' },
    details: { type: 'object', additionalProperties: true },
  },
} as const;

export default async function quickAddRoutes(fastify: FastifyInstance) {
  const quickAddService = new QuickAddService(fastify.db);
  const cardService = new CardService(fastify.db);
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);
  cardService.setListService(listService);

  // POST /api/v1/quick-add — bearer-token auth so iOS/watchOS Shortcuts can call it
  fastify.post('/quick-add', {
    config: {
      rateLimit: {
        max: Number(process.env.RATE_LIMIT_MAX) || 30,
        timeWindow: '1 minute',
      },
    },
    schema: {
      response: {
        201: quickAddResponse201,
        400: errorResponse,
        401: errorResponse,
        409: errorResponse,
      },
    },
  }, async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    const user = token ? await quickAddService.verifyToken(token) : null;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const data = await validateBody(quickAddSchema, request.body, reply);
    if (!data) return;

    const target = await quickAddService.resolveTarget(user.id, data.text);
    if (!target) {
      return reply.code(409).send({
        error: 'No default list configured for quick add',
        code: 'QUICK_ADD_NOT_CONFIGURED',
      });
    }

    const card = await cardService.create(target.listId, { title: target.title });
    return reply.code(201).send({ card, board: target.boardName, list: target.listName });
  });

  // GET /api/v1/quick-add/config
  fastify.get('/quick-add/config', {
    preHandler: [fastify.requireAuth],
    schema: {
      response: { 200: configResponse },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const [list, tokenInfo] = await Promise.all([
      quickAddService.getDefaultList(user.id),
      quickAddService.getTokenInfo(user.id),
    ]);
    return { list, token: tokenInfo };
  });

  // PUT /api/v1/quick-add/config
  fastify.put('/quick-add/config', {
    preHandler: [fastify.requireAuth],
    schema: {
      response: { 200: okResponse },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;

    const data = await validateBody(quickAddConfigSchema, request.body, reply);
    if (!data) return;

    if (data.listId !== null) {
      await verifyListOwnership(data.listId, user.id, listService, boardService);
    }

    await quickAddService.setDefaultList(user.id, data.listId);
    return { ok: true };
  });

  // POST /api/v1/quick-add/token — generate/rotate; plaintext returned only here
  fastify.post('/quick-add/token', {
    preHandler: [fastify.requireAuth],
    schema: {
      response: { 201: tokenResponse201 },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const token = await quickAddService.generateToken(user.id);
    return reply.code(201).send({ token });
  });

  // DELETE /api/v1/quick-add/token
  fastify.delete('/quick-add/token', {
    preHandler: [fastify.requireAuth],
    schema: {
      response: { 200: okResponse },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    await quickAddService.revokeToken(user.id);
    return { ok: true };
  });
}
