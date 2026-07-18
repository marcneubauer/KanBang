import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { CommentService } from '../../services/comment.service.js';
import { CardService } from '../../services/card.service.js';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import { createCommentSchema, updateCommentSchema } from '@kanbang/shared/validation/comment.js';
import { validateBody } from '../../utils/validate.js';
import { verifyCardOwnership } from '../../utils/ownership.js';

const commentResponse = {
  type: 'object',
  properties: { comment: { $ref: 'comment#' } },
} as const;

const commentsResponse = {
  type: 'object',
  properties: { comments: { type: 'array', items: { $ref: 'comment#' } } },
} as const;

const okResponse = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
} as const;

export default async function commentRoutes(fastify: FastifyInstance) {
  const commentService = new CommentService(fastify.db);
  const cardService = new CardService(fastify.db);
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  const verifyComment = async (commentId: string, userId: string) => {
    const cardId = await commentService.getCardId(commentId);
    if (!cardId) {
      const err = new Error('Comment not found') as Error & { statusCode: number; code: string };
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    await verifyCardOwnership(cardId, userId, cardService, listService, boardService);
    return cardId;
  };

  // GET /api/v1/cards/:cardId/comments
  fastify.get<{ Params: { cardId: string } }>('/cards/:cardId/comments', {
    schema: {
      response: { 200: commentsResponse },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { cardId } = request.params;

    await verifyCardOwnership(cardId, user.id, cardService, listService, boardService);

    const comments = await commentService.listByCard(cardId);
    return { comments };
  });

  // POST /api/v1/cards/:cardId/comments
  fastify.post<{ Params: { cardId: string } }>('/cards/:cardId/comments', {
    schema: {
      response: { 201: commentResponse },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { cardId } = request.params;

    await verifyCardOwnership(cardId, user.id, cardService, listService, boardService);

    const data = await validateBody(createCommentSchema, request.body, reply);
    if (!data) return;

    const comment = await commentService.create(cardId, data);
    return reply.code(201).send({ comment });
  });

  // PATCH /api/v1/comments/:commentId
  fastify.patch<{ Params: { commentId: string } }>('/comments/:commentId', {
    schema: {
      response: { 200: commentResponse },
    },
  }, async (request, reply) => {
    const { user } = request as AuthenticatedRequest;
    const { commentId } = request.params;

    await verifyComment(commentId, user.id);

    const data = await validateBody(updateCommentSchema, request.body, reply);
    if (!data) return;

    const comment = await commentService.update(commentId, data);
    return { comment };
  });

  // DELETE /api/v1/comments/:commentId
  fastify.delete<{ Params: { commentId: string } }>('/comments/:commentId', {
    schema: {
      response: { 200: okResponse },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const { commentId } = request.params;

    await verifyComment(commentId, user.id);

    await commentService.delete(commentId);
    return { ok: true };
  });
}
