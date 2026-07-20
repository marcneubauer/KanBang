import type { FastifyInstance, FastifyReply } from 'fastify';
import { nanoid } from 'nanoid';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { AttachmentService } from '../../services/attachment.service.js';
import { CardService } from '../../services/card.service.js';
import { ListService } from '../../services/list.service.js';
import { BoardService } from '../../services/board.service.js';
import { verifyCardOwnership } from '../../utils/ownership.js';

const attachmentResponse = {
  type: 'object',
  properties: { attachment: { $ref: 'attachment#' } },
} as const;

const attachmentsResponse = {
  type: 'object',
  properties: { attachments: { type: 'array', items: { $ref: 'attachment#' } } },
} as const;

const okResponse = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
} as const;

const errorResponse = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
} as const;

export default async function attachmentRoutes(fastify: FastifyInstance) {
  const attachmentService = new AttachmentService(fastify.db);
  const cardService = new CardService(fastify.db);
  const listService = new ListService(fastify.db);
  const boardService = new BoardService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  /** 404 unless the attachment exists and belongs to the session user. */
  const getOwnAttachment = async (id: string, userId: string) => {
    const attachment = await attachmentService.get(id);
    if (!attachment || attachment.userId !== userId) {
      const err = new Error('Attachment not found') as Error & { statusCode: number; code: string };
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    return attachment;
  };

  const streamFile = (
    reply: FastifyReply,
    storageKey: string,
    mimeType: string,
    filename: string,
  ) => {
    if (!fastify.fileStorage.exists(storageKey)) {
      return reply.code(404).send({ error: 'File not found', code: 'NOT_FOUND' });
    }
    const safeName = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
    return reply
      .header('content-type', mimeType)
      .header('content-disposition', `inline; filename="${safeName}"`)
      // Content for a given id never changes, so clients may cache indefinitely
      .header('cache-control', 'private, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .send(fastify.fileStorage.createReadStream(storageKey));
  };

  // POST /api/v1/cards/:cardId/attachments — multipart image upload
  fastify.post<{ Params: { cardId: string } }>(
    '/cards/:cardId/attachments',
    {
      schema: {
        response: { 201: attachmentResponse, 400: errorResponse, 413: errorResponse },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      await verifyCardOwnership(cardId, user.id, cardService, listService, boardService);

      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ error: 'No file uploaded', code: 'NO_FILE' });
      }
      // Throws a 413-coded error when the multipart size limit is exceeded
      const buffer = await file.toBuffer();

      const id = nanoid();
      const stored = await fastify.fileStorage.storeImage(id, buffer);
      try {
        const attachment = await attachmentService.create({
          id,
          userId: user.id,
          cardId,
          filename: file.filename || 'upload',
          mimeType: stored.mimeType,
          sizeBytes: buffer.length,
          width: stored.width,
          height: stored.height,
          storageKey: stored.storageKey,
          thumbKey: stored.thumbKey,
        });
        return reply.code(201).send({ attachment });
      } catch (err) {
        await fastify.fileStorage.remove(stored.storageKey, stored.thumbKey);
        throw err;
      }
    },
  );

  // GET /api/v1/cards/:cardId/attachments
  fastify.get<{ Params: { cardId: string } }>(
    '/cards/:cardId/attachments',
    {
      schema: { response: { 200: attachmentsResponse } },
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const { cardId } = request.params;

      await verifyCardOwnership(cardId, user.id, cardService, listService, boardService);

      const attachments = await attachmentService.listByCard(cardId);
      return { attachments };
    },
  );

  // DELETE /api/v1/attachments/:attachmentId
  fastify.delete<{ Params: { attachmentId: string } }>(
    '/attachments/:attachmentId',
    {
      schema: { response: { 200: okResponse } },
    },
    async (request) => {
      const { user } = request as AuthenticatedRequest;
      const attachment = await getOwnAttachment(request.params.attachmentId, user.id);

      await attachmentService.delete(attachment.id);
      await fastify.fileStorage.remove(attachment.storageKey, attachment.thumbKey);
      return { ok: true };
    },
  );

  // GET /api/v1/files/:attachmentId — streams the original image
  fastify.get<{ Params: { attachmentId: string } }>(
    '/files/:attachmentId',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const attachment = await getOwnAttachment(request.params.attachmentId, user.id);

      return streamFile(reply, attachment.storageKey, attachment.mimeType, attachment.filename);
    },
  );

  // GET /api/v1/files/:attachmentId/thumb — thumbnail, falls back to the original
  fastify.get<{ Params: { attachmentId: string } }>(
    '/files/:attachmentId/thumb',
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const attachment = await getOwnAttachment(request.params.attachmentId, user.id);

      const key = attachment.thumbKey ?? attachment.storageKey;
      const mime = attachment.thumbKey ? 'image/webp' : attachment.mimeType;
      return streamFile(reply, key, mime, attachment.filename);
    },
  );
}
