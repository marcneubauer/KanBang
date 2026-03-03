import type { FastifyInstance, FastifyReply } from 'fastify';
import { registerSchema, loginSchema } from '@kanbang/shared/validation/auth.js';
import { COOKIE_NAME, SESSION_MAX_AGE } from '../../plugins/auth.js';

function setCookie(reply: FastifyReply, sessionId: string) {
  reply.setCookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

function clearCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/v1/auth/register
  fastify.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const result = await fastify.authService.register(parsed.data);
      setCookie(reply, result.session.id);
      return reply.code(201).send({ user: result.user });
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes('UNIQUE constraint failed')) {
        return reply.code(409).send({
          error: 'Email or username already taken',
          code: 'CONFLICT',
        });
      }
      throw err;
    }
  });

  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await fastify.authService.login(parsed.data);
    if (!result) {
      return reply.code(401).send({
        error: 'Invalid email or password',
        code: 'UNAUTHORIZED',
      });
    }

    setCookie(reply, result.session.id);
    return { user: result.user };
  });

  // POST /api/v1/auth/logout
  fastify.post('/logout', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const sessionId = request.cookies[COOKIE_NAME];
    if (sessionId) {
      await fastify.authService.destroySession(sessionId);
    }
    clearCookie(reply);
    return { ok: true };
  });

  // GET /api/v1/auth/me
  fastify.get('/me', { preHandler: [fastify.requireAuth] }, async (request) => {
    return { user: request.user };
  });
}
