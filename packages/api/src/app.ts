import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import dbPlugin from './plugins/db.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth/index.js';
import boardRoutes from './routes/boards/index.js';
import listRoutes from './routes/lists/index.js';
import cardRoutes from './routes/cards/index.js';
import passkeyRoutes from './routes/passkeys/index.js';
import { config } from './config.js';

export interface BuildAppOptions {
  databaseUrl?: string;
  logger?: boolean | object;
}

export async function buildApp(opts: BuildAppOptions = {}) {
  const app = Fastify({
    logger: opts.logger ?? {
      level: process.env.LOG_LEVEL || 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });

  await app.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  await app.register(cookie);
  await app.register(dbPlugin, { databaseUrl: opts.databaseUrl });
  await app.register(authPlugin);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode ?? 500;
    const code = error.code ?? 'INTERNAL_ERROR';
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : error.message,
      code,
    });
  });

  // Health check
  app.get('/api/v1/health', async () => {
    return { status: 'ok' };
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(boardRoutes, { prefix: '/api/v1/boards' });
  await app.register(listRoutes, { prefix: '/api/v1' });
  await app.register(cardRoutes, { prefix: '/api/v1' });
  await app.register(passkeyRoutes, { prefix: '/api/v1/passkeys' });

  return app;
}
