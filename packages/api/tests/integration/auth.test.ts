import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { sessions } from '../../src/db/schema.js';
import { createTestApp, registerUser, loginUser, authHeader } from './helpers.js';

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user', async () => {
      const { response, body, sessionCookie } = await registerUser(app);
      expect(response.statusCode).toBe(201);
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.username).toBe('testuser');
      expect(body.user.id).toBeDefined();
      expect(sessionCookie).toBeDefined();
    });

    it('rejects duplicate email', async () => {
      await registerUser(app);
      const { response, body } = await registerUser(app, { username: 'different' });
      expect(response.statusCode).toBe(409);
      expect(body.code).toBe('CONFLICT');
    });

    it('rejects duplicate username', async () => {
      await registerUser(app);
      const { response, body } = await registerUser(app, { email: 'other@example.com' });
      expect(response.statusCode).toBe(409);
      expect(body.code).toBe('CONFLICT');
    });

    it('rejects invalid email', async () => {
      const { response, body } = await registerUser(app, { email: 'not-an-email' });
      expect(response.statusCode).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects short password', async () => {
      const { response, body } = await registerUser(app, { password: 'short' });
      expect(response.statusCode).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects short username', async () => {
      const { response, body } = await registerUser(app, { username: 'ab' });
      expect(response.statusCode).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects username with invalid characters', async () => {
      const { response, body } = await registerUser(app, { username: 'user name!' });
      expect(response.statusCode).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await registerUser(app);
    });

    it('logs in with valid credentials', async () => {
      const { response, body, sessionCookie } = await loginUser(app);
      expect(response.statusCode).toBe(200);
      expect(body.user.email).toBe('test@example.com');
      expect(sessionCookie).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const { response, body } = await loginUser(app, { password: 'wrongpassword' });
      expect(response.statusCode).toBe(401);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('rejects non-existent email', async () => {
      const { response, body } = await loginUser(app, { email: 'nobody@example.com' });
      expect(response.statusCode).toBe(401);
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns user when authenticated', async () => {
      const { sessionCookie } = await registerUser(app);
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: authHeader(sessionCookie!),
      });
      const body = JSON.parse(response.body);
      expect(response.statusCode).toBe(200);
      expect(body.user.email).toBe('test@example.com');
    });

    it('returns 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });
      expect(response.statusCode).toBe(401);
    });

    it('defaults theme to system and persists PATCHed changes', async () => {
      const { sessionCookie } = await registerUser(app);

      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: authHeader(sessionCookie!),
      });
      expect(JSON.parse(me.body).user.theme).toBe('system');

      const patch = await app.inject({
        method: 'PATCH',
        url: '/api/v1/auth/me',
        headers: authHeader(sessionCookie!),
        payload: { theme: 'dark' },
      });
      expect(patch.statusCode).toBe(200);
      expect(JSON.parse(patch.body).user.theme).toBe('dark');

      // Round-trips through the session-based /me (serialization check)
      const me2 = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: authHeader(sessionCookie!),
      });
      expect(JSON.parse(me2.body).user.theme).toBe('dark');

      const bad = await app.inject({
        method: 'PATCH',
        url: '/api/v1/auth/me',
        headers: authHeader(sessionCookie!),
        payload: { theme: 'neon' },
      });
      expect(bad.statusCode).toBe(400);
    });

    it('returns 401 with invalid session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: authHeader('invalid-session-id'),
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 and deletes expired session', async () => {
      const { sessionCookie } = await registerUser(app);

      // Expire the session by backdating it
      await app.db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(sessions.id, sessionCookie!));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: authHeader(sessionCookie!),
      });
      expect(response.statusCode).toBe(401);

      // Expired session row should have been deleted
      const rows = await app.db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionCookie!));
      expect(rows).toHaveLength(0);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('destroys the session', async () => {
      const { sessionCookie } = await registerUser(app);

      // Logout
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: authHeader(sessionCookie!),
      });
      expect(logoutRes.statusCode).toBe(200);

      // Verify session is destroyed
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: authHeader(sessionCookie!),
      });
      expect(meRes.statusCode).toBe(401);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    const NEW_PASSWORD = 'newpassword12345';

    it('changes the password and allows login with the new one', async () => {
      const { sessionCookie } = await registerUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: authHeader(sessionCookie!),
        payload: { currentPassword: 'password12345', newPassword: NEW_PASSWORD },
      });
      expect(response.statusCode).toBe(200);

      const oldLogin = await loginUser(app);
      expect(oldLogin.response.statusCode).toBe(401);

      const newLogin = await loginUser(app, { password: NEW_PASSWORD });
      expect(newLogin.response.statusCode).toBe(200);
    });

    it('rejects a wrong current password', async () => {
      const { sessionCookie } = await registerUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: authHeader(sessionCookie!),
        payload: { currentPassword: 'wrongpassword12345', newPassword: NEW_PASSWORD },
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).code).toBe('INVALID_PASSWORD');

      const login = await loginUser(app);
      expect(login.response.statusCode).toBe(200);
    });

    it('rejects a too-short new password', async () => {
      const { sessionCookie } = await registerUser(app);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: authHeader(sessionCookie!),
        payload: { currentPassword: 'password12345', newPassword: 'short' },
      });
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('invalidates other sessions but keeps the current one', async () => {
      const { sessionCookie } = await registerUser(app);
      const otherLogin = await loginUser(app);
      const otherCookie = otherLogin.sessionCookie;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: authHeader(sessionCookie!),
        payload: { currentPassword: 'password12345', newPassword: NEW_PASSWORD },
      });
      expect(response.statusCode).toBe(200);

      const otherMe = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: authHeader(otherCookie!),
      });
      expect(otherMe.statusCode).toBe(401);

      const currentMe = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: authHeader(sessionCookie!),
      });
      expect(currentMe.statusCode).toBe(200);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        payload: { currentPassword: 'password12345', newPassword: NEW_PASSWORD },
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
