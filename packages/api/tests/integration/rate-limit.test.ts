import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp, registerUser } from './helpers.js';

describe('Rate limiting', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await registerUser(app);
    });

    it('allows requests under the rate limit', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: {
            email: 'test@example.com',
            password: 'wrongpassword1',
          },
        });
        expect(response.statusCode).not.toBe(429);
      }
    });

    it('returns 429 after exceeding the rate limit', async () => {
      // Exhaust the 10-request limit
      for (let i = 0; i < 10; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: {
            email: 'test@example.com',
            password: 'wrongpassword1',
          },
        });
      }

      // 11th request should be rate-limited
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword1',
        },
      });
      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('includes rate limit headers', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword1',
        },
      });
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('returns 429 after exceeding the rate limit', async () => {
      // Exhaust the 10-request limit
      for (let i = 0; i < 10; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          payload: {
            email: `user${i}@example.com`,
            username: `user${i}`,
            password: 'password12345',
          },
        });
      }

      // 11th request should be rate-limited
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'overflow@example.com',
          username: 'overflowuser',
          password: 'password12345',
        },
      });
      expect(response.statusCode).toBe(429);
    });
  });

  describe('non-rate-limited routes', () => {
    it('does not rate limit the health endpoint', async () => {
      for (let i = 0; i < 15; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/health',
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });
});
