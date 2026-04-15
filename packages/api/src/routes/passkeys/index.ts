import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../../plugins/auth.js';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { COOKIE_NAME, SESSION_MAX_AGE } from '../../plugins/auth.js';

const CHALLENGE_COOKIE = 'kanbang_webauthn_challenge';
const CHALLENGE_MAX_AGE = 5 * 60; // 5 minutes

function setChallengeCookie(reply: FastifyReply, challenge: string) {
  reply.setCookie(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CHALLENGE_MAX_AGE,
  });
}

function clearChallengeCookie(reply: FastifyReply) {
  reply.clearCookie(CHALLENGE_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

function setSessionCookie(reply: FastifyReply, sessionId: string) {
  reply.setCookie(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

const okResponse = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
} as const;

const errorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code:  { type: 'string' },
  },
} as const;

const webauthnOptionsResponse = {
  type: 'object',
  properties: {
    options: { type: 'object', additionalProperties: true },
  },
} as const;

export default async function passkeyRoutes(fastify: FastifyInstance) {
  // GET /api/v1/passkeys — list user's passkeys
  fastify.get('/', {
    preHandler: [fastify.requireAuth],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            passkeys: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id:         { type: 'string' },
                  deviceType: { type: 'string' },
                  backedUp:   { type: 'boolean' },
                  createdAt:  { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { user } = request as AuthenticatedRequest;
    const creds = await fastify.passkeyService.getCredentialsByUserId(user.id);
    return {
      passkeys: creds.map((c) => ({
        id: c.id,
        deviceType: c.deviceType,
        backedUp: c.backedUp,
        createdAt: c.createdAt,
      })),
    };
  });

  // DELETE /api/v1/passkeys/:credentialId — delete a passkey
  fastify.delete(
    '/:credentialId',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        response: {
          200: okResponse,
          404: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const { credentialId } = request.params as { credentialId: string };
      const deleted = await fastify.passkeyService.deleteCredential(credentialId, user.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Passkey not found', code: 'NOT_FOUND' });
      }
      return { ok: true };
    },
  );

  // POST /api/v1/passkeys/register/options — start passkey registration
  fastify.post(
    '/register/options',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        response: {
          200: webauthnOptionsResponse,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const options = await fastify.passkeyService.generateRegOptions(user);
      setChallengeCookie(reply, options.challenge);
      return { options };
    },
  );

  // POST /api/v1/passkeys/register/verify — complete passkey registration
  fastify.post(
    '/register/verify',
    {
      preHandler: [fastify.requireAuth],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: { verified: { type: 'boolean' } },
          },
          400: errorResponse,
        },
      },
    },
    async (request, reply) => {
      const { user } = request as AuthenticatedRequest;
      const challenge = request.cookies[CHALLENGE_COOKIE];
      if (!challenge) {
        return reply.code(400).send({
          error: 'No challenge found. Start registration again.',
          code: 'BAD_REQUEST',
        });
      }

      try {
        const verified = await fastify.passkeyService.verifyAndSaveRegistration(
          user.id,
          challenge,
          request.body as RegistrationResponseJSON,
        );

        clearChallengeCookie(reply);

        if (!verified) {
          return reply.code(400).send({
            error: 'Registration verification failed',
            code: 'VERIFICATION_FAILED',
          });
        }

        return { verified: true };
      } catch (err: unknown) {
        clearChallengeCookie(reply);
        return reply.code(400).send({
          error: err instanceof Error ? err.message : 'Registration verification failed',
          code: 'VERIFICATION_FAILED',
        });
      }
    },
  );

  // POST /api/v1/passkeys/login/options — start passkey login
  fastify.post('/login/options', {
    schema: {
      response: {
        200: webauthnOptionsResponse,
      },
    },
  }, async (_request, reply) => {
    const options = await fastify.passkeyService.generateAuthOptions();
    setChallengeCookie(reply, options.challenge);
    return { options };
  });

  // POST /api/v1/passkeys/login/verify — complete passkey login
  fastify.post('/login/verify', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: { user: { $ref: 'user#' } },
        },
        400: errorResponse,
        401: errorResponse,
      },
    },
  }, async (request, reply) => {
    const challenge = request.cookies[CHALLENGE_COOKIE];
    if (!challenge) {
      return reply.code(400).send({
        error: 'No challenge found. Start login again.',
        code: 'BAD_REQUEST',
      });
    }

    try {
      const user = await fastify.passkeyService.verifyAuthentication(
        challenge,
        request.body as AuthenticationResponseJSON,
      );

      clearChallengeCookie(reply);

      if (!user) {
        return reply.code(401).send({
          error: 'Authentication failed',
          code: 'UNAUTHORIZED',
        });
      }

      const session = await fastify.authService.createSession(user.id);
      setSessionCookie(reply, session.id);
      return { user };
    } catch (err: unknown) {
      clearChallengeCookie(reply);
      return reply.code(401).send({
        error: err instanceof Error ? err.message : 'Authentication failed',
        code: 'UNAUTHORIZED',
      });
    }
  });
}
