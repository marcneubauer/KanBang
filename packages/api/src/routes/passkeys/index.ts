import type { FastifyInstance, FastifyReply } from 'fastify';
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

export default async function passkeyRoutes(fastify: FastifyInstance) {
  // GET /api/v1/passkeys — list user's passkeys
  fastify.get('/', { preHandler: [fastify.requireAuth] }, async (request) => {
    const creds = await fastify.passkeyService.getCredentialsByUserId(request.user!.id);
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
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const { credentialId } = request.params as { credentialId: string };
      const deleted = await fastify.passkeyService.deleteCredential(
        credentialId,
        request.user!.id,
      );
      if (!deleted) {
        return reply.code(404).send({ error: 'Passkey not found', code: 'NOT_FOUND' });
      }
      return { ok: true };
    },
  );

  // POST /api/v1/passkeys/register/options — start passkey registration
  fastify.post(
    '/register/options',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const options = await fastify.passkeyService.generateRegOptions(request.user!);
      setChallengeCookie(reply, options.challenge);
      return { options };
    },
  );

  // POST /api/v1/passkeys/register/verify — complete passkey registration
  fastify.post(
    '/register/verify',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const challenge = request.cookies[CHALLENGE_COOKIE];
      if (!challenge) {
        return reply.code(400).send({
          error: 'No challenge found. Start registration again.',
          code: 'BAD_REQUEST',
        });
      }

      try {
        const verified = await fastify.passkeyService.verifyAndSaveRegistration(
          request.user!.id,
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
  fastify.post('/login/options', async (_request, reply) => {
    const options = await fastify.passkeyService.generateAuthOptions();
    setChallengeCookie(reply, options.challenge);
    return { options };
  });

  // POST /api/v1/passkeys/login/verify — complete passkey login
  fastify.post('/login/verify', async (request, reply) => {
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
