import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import { FileStorageService } from '../services/file-storage.service.js';
import { attachments } from '../db/schema.js';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    fileStorage: FileStorageService;
  }
}

export default fp(
  async (fastify, opts: { uploadsDir?: string; uploadMaxBytes?: number }) => {
    await fastify.register(multipart, {
      limits: { fileSize: opts.uploadMaxBytes ?? config.uploads.maxBytes, files: 1 },
    });

    const fileStorage = new FileStorageService(opts.uploadsDir ?? config.uploads.dir);
    fastify.decorate('fileStorage', fileStorage);

    // Orphan sweep: files are unlinked by the API on delete; this catches rows
    // removed outside the API (skips files < 1h old, so in-flight uploads survive)
    fastify.addHook('onReady', async () => {
      const rows = await fastify.db.select({ id: attachments.id }).from(attachments);
      await fileStorage.gc(new Set(rows.map((r) => r.id)));
    });
  },
  { name: 'kanbang-uploads', dependencies: ['kanbang-db'] },
);
