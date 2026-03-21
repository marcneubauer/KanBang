import type { FastifyInstance } from 'fastify';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import {
  createListSchema,
  updateListSchema,
  reorderListSchema,
} from '@kanbang/shared/validation/list.js';

export default async function listRoutes(fastify: FastifyInstance) {
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  // GET /api/v1/lists/:listId
  fastify.get<{ Params: { listId: string } }>('/lists/:listId', async (request, reply) => {
    const { listId } = request.params;

    const boardId = await listService.getBoardId(listId);
    if (!boardId || !(await boardService.isOwner(boardId, request.user!.id))) {
      return reply.code(404).send({ error: 'List not found', code: 'NOT_FOUND' });
    }

    const list = await listService.getByIdWithCards(listId);
    return { list };
  });

  // POST /api/v1/boards/:boardId/lists
  fastify.post<{ Params: { boardId: string } }>(
    '/boards/:boardId/lists',
    async (request, reply) => {
      const { boardId } = request.params;

      if (!(await boardService.isOwner(boardId, request.user!.id))) {
        return reply.code(404).send({ error: 'Board not found', code: 'NOT_FOUND' });
      }

      const parsed = createListSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const list = await listService.create(boardId, parsed.data);
      return reply.code(201).send({ list });
    },
  );

  // PATCH /api/v1/lists/:listId
  fastify.patch<{ Params: { listId: string } }>('/lists/:listId', async (request, reply) => {
    const { listId } = request.params;

    const boardId = await listService.getBoardId(listId);
    if (!boardId || !(await boardService.isOwner(boardId, request.user!.id))) {
      return reply.code(404).send({ error: 'List not found', code: 'NOT_FOUND' });
    }

    const parsed = updateListSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const list = await listService.update(listId, parsed.data);
    return { list };
  });

  // PATCH /api/v1/lists/:listId/reorder
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/reorder',
    async (request, reply) => {
      const { listId } = request.params;

      const boardId = await listService.getBoardId(listId);
      if (!boardId || !(await boardService.isOwner(boardId, request.user!.id))) {
        return reply.code(404).send({ error: 'List not found', code: 'NOT_FOUND' });
      }

      const parsed = reorderListSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const list = await listService.reorder(listId, parsed.data.position);
      return { list };
    },
  );

  // PATCH /api/v1/lists/:listId/archive
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/archive',
    async (request, reply) => {
      const { listId } = request.params;

      const boardId = await listService.getBoardId(listId);
      if (!boardId || !(await boardService.isOwner(boardId, request.user!.id))) {
        return reply.code(404).send({ error: 'List not found', code: 'NOT_FOUND' });
      }

      await listService.archive(listId);
      return { ok: true };
    },
  );

  // PATCH /api/v1/lists/:listId/unarchive
  fastify.patch<{ Params: { listId: string } }>(
    '/lists/:listId/unarchive',
    async (request, reply) => {
      const { listId } = request.params;

      const boardId = await listService.getBoardId(listId);
      if (!boardId || !(await boardService.isOwner(boardId, request.user!.id))) {
        return reply.code(404).send({ error: 'List not found', code: 'NOT_FOUND' });
      }

      await listService.unarchive(listId);
      return { ok: true };
    },
  );
}
