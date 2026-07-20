import fp from 'fastify-plugin';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { PasskeyService } from '../services/passkey.service.js';

interface AuthUser {
  id: string;
  email: string;
  username: string;
  theme: 'light' | 'dark' | 'system';
}

/** Request type after requireAuth preHandler has run — user is guaranteed non-null */
export type AuthenticatedRequest = FastifyRequest & { user: AuthUser };

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
  interface FastifyInstance {
    authService: AuthService;
    passkeyService: PasskeyService;
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const COOKIE_NAME = 'kanbang_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export { COOKIE_NAME, SESSION_MAX_AGE };

export default fp(
  async (fastify) => {
    const authService = new AuthService(fastify.db);
    fastify.decorate('authService', authService);

    const passkeyService = new PasskeyService(fastify.db);
    fastify.decorate('passkeyService', passkeyService);

    fastify.decorateRequest('user', null);

    // Parse session on every request
    fastify.addHook('onRequest', async (request) => {
      const sessionId = request.cookies[COOKIE_NAME];
      if (!sessionId) return;

      const user = await authService.validateSession(sessionId);
      if (user) {
        request.user = user;
      }
    });

    // Helper to require auth on specific routes
    fastify.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      }
    });
  },
  { name: 'kanbang-auth', dependencies: ['kanbang-db'] },
);
