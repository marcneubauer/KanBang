import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { LightMyRequestResponse } from 'light-my-request';
import { createTestApp, registerUser, authHeader } from './helpers.js';

function getChallengeCookie(response: LightMyRequestResponse): string | undefined {
  const cookies = response.cookies as Array<{ name: string; value: string }>;
  return cookies?.find((c) => c.name === 'kanbang_webauthn_challenge')?.value;
}

describe('Passkey routes', () => {
  let app: FastifyInstance;
  let sessionCookie: string;

  beforeEach(async () => {
    app = await createTestApp();
    const result = await registerUser(app);
    sessionCookie = result.sessionCookie!;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/passkeys/register/options', () => {
    it('returns registration options when authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/register/options',
        headers: authHeader(sessionCookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.options).toBeDefined();
      expect(body.options.challenge).toBeDefined();
      expect(body.options.rp).toBeDefined();
      expect(body.options.rp.name).toBe('KanBang');
      expect(body.options.user).toBeDefined();
      expect(body.options.pubKeyCredParams).toBeDefined();

      const challenge = getChallengeCookie(response);
      expect(challenge).toBeDefined();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/register/options',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/passkeys/register/verify', () => {
    it('returns 400 when no challenge cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/register/verify',
        headers: authHeader(sessionCookie),
        payload: {},
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.code).toBe('BAD_REQUEST');
    });

    it('returns 400 with invalid attestation response', async () => {
      // First get options to set the challenge cookie
      const optionsRes = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/register/options',
        headers: authHeader(sessionCookie),
      });
      const challenge = getChallengeCookie(optionsRes);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/register/verify',
        headers: {
          ...authHeader(sessionCookie),
          cookie: `kanbang_session=${sessionCookie}; kanbang_webauthn_challenge=${challenge}`,
        },
        payload: {
          id: 'fake-id',
          rawId: 'fake-raw-id',
          response: {
            attestationObject: 'fake',
            clientDataJSON: 'fake',
          },
          type: 'public-key',
          clientExtensionResults: {},
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/register/verify',
        payload: {},
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/passkeys/login/options', () => {
    it('returns authentication options', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/login/options',
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.options).toBeDefined();
      expect(body.options.challenge).toBeDefined();
      expect(body.options.rpId).toBe('localhost');

      const challenge = getChallengeCookie(response);
      expect(challenge).toBeDefined();
    });
  });

  describe('POST /api/v1/passkeys/login/verify', () => {
    it('returns 400 when no challenge cookie', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/login/verify',
        payload: {},
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(400);
      expect(body.code).toBe('BAD_REQUEST');
    });

    it('returns 401 with non-existent credential', async () => {
      // Get options to set challenge cookie
      const optionsRes = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/login/options',
      });
      const challenge = getChallengeCookie(optionsRes);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/passkeys/login/verify',
        headers: {
          cookie: `kanbang_webauthn_challenge=${challenge}`,
        },
        payload: {
          id: 'non-existent-credential',
          rawId: 'non-existent-credential',
          response: {
            authenticatorData: 'fake',
            clientDataJSON: 'fake',
            signature: 'fake',
          },
          type: 'public-key',
          clientExtensionResults: {},
        },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/passkeys', () => {
    it('returns empty list when no passkeys registered', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/passkeys',
        headers: authHeader(sessionCookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.passkeys).toEqual([]);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/passkeys',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/v1/passkeys/:credentialId', () => {
    it('returns 404 for non-existent passkey', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/passkeys/non-existent-id',
        headers: authHeader(sessionCookie),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(404);
      expect(body.code).toBe('NOT_FOUND');
    });

    it('returns 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/passkeys/some-id',
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
