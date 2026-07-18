import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { TrelloImportService } from '../../services/trello-import.service.js';
import { trelloBoardExportSchema } from '@kanbang/shared/validation/trello-import.js';

const importResponse201 = {
  type: 'object',
  properties: {
    summary: {
      type: 'object',
      properties: {
        boardId: { type: 'string' },
        boardName: { type: 'string' },
        lists: { type: 'number' },
        cards: { type: 'number' },
        labels: { type: 'number' },
        checklists: { type: 'number' },
        checklistItems: { type: 'number' },
      },
    },
  },
} as const;

const errorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: { type: 'string' },
  },
} as const;

export default async function importRoutes(fastify: FastifyInstance) {
  const trelloImportService = new TrelloImportService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  // POST /api/v1/import/trello — body is a Trello per-board JSON export (can be several MB)
  fastify.post('/import/trello', {
    bodyLimit: 25 * 1024 * 1024,
    schema: {
      response: {
        201: importResponse201,
        400: errorResponse,
      },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;

    const parsed = trelloBoardExportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Not a valid Trello board export (expected the per-board JSON export)',
        code: 'INVALID_TRELLO_EXPORT',
      });
    }

    const summary = trelloImportService.importBoard(user.id, parsed.data);
    return reply.code(201).send({ summary });
  });
}
