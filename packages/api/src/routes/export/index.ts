import type { FastifyInstance } from 'fastify';
import { ZipFile } from 'yazl';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import { ExportService } from '../../services/export.service.js';

export default async function exportRoutes(fastify: FastifyInstance) {
  const exportService = new ExportService(fastify.db);

  fastify.addHook('preHandler', fastify.requireAuth);

  const buildExport = async (user: AuthenticatedRequest['user']) => ({
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email, username: user.username },
    boards: await exportService.exportUserData(user.id),
  });

  // GET /api/v1/export
  fastify.get('/export', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;

    const date = new Date().toISOString().slice(0, 10);
    reply.header('content-disposition', `attachment; filename="kanbang-export-${date}.json"`);

    return buildExport(user);
  });

  // GET /api/v1/export/archive — zip of export.json + all attachment files
  fastify.get('/export/archive', async (request, reply) => {
    const { user } = request as AuthenticatedRequest;

    const data = await buildExport(user);
    const zip = new ZipFile();
    zip.addBuffer(Buffer.from(JSON.stringify(data, null, 2)), 'export.json');

    for (const att of await exportService.listAttachments(user.id)) {
      if (fastify.fileStorage.exists(att.storageKey)) {
        zip.addFile(fastify.fileStorage.resolvePath(att.storageKey), `files/${att.storageKey}`);
      }
    }
    zip.end();

    const date = new Date().toISOString().slice(0, 10);
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="kanbang-export-${date}.zip"`)
      .send(zip.outputStream);
  });
}
