import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import dbPlugin from './plugins/db.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth/index.js';
import boardRoutes from './routes/boards/index.js';
import listRoutes from './routes/lists/index.js';
import cardRoutes from './routes/cards/index.js';
import checklistRoutes from './routes/checklists/index.js';
import passkeyRoutes from './routes/passkeys/index.js';
import { config } from './config.js';
import { allSchemas } from './schemas/index.js';

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

  await app.register(sensible);
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(dbPlugin, { databaseUrl: opts.databaseUrl });
  await app.register(authPlugin);

  // Register shared JSON schemas for fast-json-stringify serialization
  for (const schema of allSchemas) {
    app.addSchema(schema);
  }

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    if (error.validation) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.validation,
      });
    }
    const statusCode = error.statusCode ?? 500;
    const code = error.code ?? 'INTERNAL_ERROR';
    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal server error' : error.message,
      code,
    });
  });

  app.setNotFoundHandler(async (request, reply) => {
    reply.code(404).send({ error: 'Not found', code: 'NOT_FOUND' });
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
  await app.register(checklistRoutes, { prefix: '/api/v1' });
  await app.register(passkeyRoutes, { prefix: '/api/v1/passkeys' });

  return app;
}
