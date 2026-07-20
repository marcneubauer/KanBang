import { and, eq, ne } from 'drizzle-orm';
import { hash, verify } from 'argon2';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import type { RegisterInput, LoginInput } from '@kanbang/shared/validation/auth.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class AuthService {
  constructor(private db: Database) {}

  async register(input: RegisterInput) {
    const passwordHash = await hash(input.password);
    const now = new Date();
    const id = nanoid();

    const [user] = await this.db
      .insert(users)
      .values({
        id,
        email: input.email,
        username: input.username,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        theme: users.theme,
      });

    const session = await this.createSession(user.id);
    return { user, session };
  }

  async login(input: LoginInput) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user || !user.passwordHash) {
      return null;
    }

    const valid = await verify(user.passwordHash, input.password);
    if (!valid) {
      return null;
    }

    const session = await this.createSession(user.id);
    return {
      user: { id: user.id, email: user.email, username: user.username, theme: user.theme },
      session,
    };
  }

  /**
   * Change the user's password after verifying the current one.
   * Invalidates all other sessions. Returns false if the current password is wrong.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentSessionId: string,
  ) {
    const [user] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.passwordHash) return false;

    const valid = await verify(user.passwordHash, currentPassword);
    if (!valid) return false;

    const passwordHash = await hash(newPassword);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), ne(sessions.id, currentSessionId)));

    return true;
  }

  async createSession(userId: string) {
    const id = nanoid();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

    const [session] = await this.db
      .insert(sessions)
      .values({ id, userId, expiresAt, createdAt: now })
      .returning();

    return session;
  }

  async validateSession(sessionId: string) {
    const [result] = await this.db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        userId: users.id,
        email: users.email,
        username: users.username,
        theme: users.theme,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!result) return null;

    if (result.expiresAt < new Date()) {
      await this.db.delete(sessions).where(eq(sessions.id, sessionId));
      return null;
    }

    // Sliding expiry
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.db
      .update(sessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(sessions.id, sessionId));

    return {
      id: result.userId,
      email: result.email,
      username: result.username,
      theme: result.theme,
    };
  }

  async destroySession(sessionId: string) {
    await this.db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  async getUserById(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        theme: users.theme,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  }

  async updateTheme(userId: string, theme: 'light' | 'dark' | 'system') {
    const [user] = await this.db
      .update(users)
      .set({ theme, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        theme: users.theme,
      });

    return user ?? null;
  }
}
