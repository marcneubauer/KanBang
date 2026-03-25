import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import {
  createListSchema,
  updateListSchema,
  reorderListSchema,
} from '@kanbang/shared/validation/list.js';
import { validateBody } from '../../utils/validate.js';
import { verifyBoardOwnership, verifyListOwnership } from '../../utils/ownership.js';

export default async function listRoutes(fastify: FastifyInstance) {
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  // GET /api/v1/lists/:listId
  fastify.get<{ Params: { listId: string } }>('/lists/:listId', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { listId } = request.params;

    if (!(await verifyListOwnership(listId, user.id, listService, boardService, reply))) return;

    const list = await listService.getByIdWithCards(listId);
    return { list };
  });

  // POST /api/v1/boards/:boardId/lists
  fastify.post<{ Params: { boardId: string } }>(
    '/boards/:boardId/lists',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { boardId } = request.params;

      if (!(await verifyBoardOwnership(boardId, user.id, boardService, reply))) return;

      const data = await validateBody(createListSchema, request.body, reply);
      if (!data) return;

      const list = await listService.create(boardId, data);
      return reply.code(201).send({ list });
    },
  );

  // PATCH /api/v1/lists/:listId
  fastify.patch<{ Params: { listId: string } }>('/lists/:listId', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { listId } = request.params;

    if (!(await verifyListOwnership(listId, user.id, listService, boardService, reply))) return;

    const data = await validateBody(updateListSchema, request.body, reply);
    if (!data) return;

    const list = await listService.update(listId, data);
    return { list };
  });

  // PATCH /api/v1/lists/:listId/reorder
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/reorder',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      if (!(await verifyListOwnership(listId, user.id, listService, boardService, reply))) return;

      const data = await validateBody(reorderListSchema, request.body, reply);
      if (!data) return;

      const list = await listService.reorder(listId, data.position);
      return { list };
    },
  );

  // PATCH /api/v1/lists/:listId/archive
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/archive',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      if (!(await verifyListOwnership(listId, user.id, listService, boardService, reply))) return;

      await listService.archive(listId);
      return { ok: true };
    },
  );

  // PATCH /api/v1/lists/:listId/unarchive
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/unarchive',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { listId } = request.params;

      if (!(await verifyListOwnership(listId, user.id, listService, boardService, reply))) return;

      await listService.unarchive(listId);
      return { ok: true };
    },
  );
}
