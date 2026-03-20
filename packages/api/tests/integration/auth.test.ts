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
});
