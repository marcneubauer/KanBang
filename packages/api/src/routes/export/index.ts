import type { FastifyInstance } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { ExportService } from '../../services/export.service.js';

export default async function exportRoutes(fastify: FastifyInstance) {
  const exportService = new ExportService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  // GET /api/v1/export
  fastify.get('/export', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;

    const exportedBoards = await exportService.exportUserData(user.id);

    const date = new Date().toISOString().slice(0, 10);
    reply.header('content-disposition', `attachment; filename="kanbang-export-${date}.json"`);

    return {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, email: user.email, username: user.username },
      boards: exportedBoards,
    };
  });
}
