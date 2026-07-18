import { createHash, randomBytes } from 'node:crypto';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { apiTokens, boards, lists, users } from '../db/schema.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface QuickAddTarget {
  listId: string;
  listName: string;
  boardId: string;
  boardName: string;
  title: string;
}

export class QuickAddService {
  constructor(private db: Database) {}

  /** Generate (or rotate) the user's quick-add token. The plaintext is returned once and only the hash is stored. */
  async generateToken(userId: string) {
    const token = `kb_${randomBytes(32).toString('base64url')}`;
    await this.db.delete(apiTokens).where(eq(apiTokens.userId, userId));
    await this.db.insert(apiTokens).values({
      id: nanoid(),
      userId,
      tokenHash: hashToken(token),
      createdAt: new Date(),
    });
    return token;
  }

  async revokeToken(userId: string) {
    await this.db.delete(apiTokens).where(eq(apiTokens.userId, userId));
  }

  async getTokenInfo(userId: string) {
    const [row] = await this.db
      .select({ createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt })
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId))
      .limit(1);
    return row ?? null;
  }

  /** Resolve a bearer token to its user and update lastUsedAt. Returns null when invalid. */
  async verifyToken(token: string) {
    const [row] = await this.db
      .select({
        tokenId: apiTokens.id,
        userId: users.id,
        email: users.email,
        username: users.username,
      })
      .from(apiTokens)
      .innerJoin(users, eq(apiTokens.userId, users.id))
      .where(eq(apiTokens.tokenHash, hashToken(token)))
      .limit(1);

    if (!row) return null;

    await this.db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, row.tokenId));

    return { id: row.userId, email: row.email, username: row.username };
  }

  async setDefaultList(userId: string, listId: string | null) {
    await this.db
      .update(users)
      .set({ quickAddListId: listId, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  /** The configured default list, or null when unset or no longer valid (archived/deleted/foreign). */
  async getDefaultList(userId: string) {
    const [row] = await this.db
      .select({ listId: users.quickAddListId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row?.listId) return null;

    const [target] = await this.db
      .select({
        listId: lists.id,
        listName: lists.name,
        boardId: boards.id,
        boardName: boards.name,
      })
      .from(lists)
      .innerJoin(boards, eq(lists.boardId, boards.id))
      .where(
        and(
          eq(lists.id, row.listId),
          isNull(lists.archivedAt),
          isNull(boards.archivedAt),
          eq(boards.userId, userId),
        ),
      )
      .limit(1);

    return target ?? null;
  }

  /**
   * Resolve where a quick-add text should land.
   * A "Board name: task title" prefix targets the named board's leftmost list;
   * otherwise the full text becomes a card on the configured default list.
   */
  async resolveTarget(userId: string, text: string): Promise<QuickAddTarget | null> {
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx < text.length - 1) {
      const boardName = text.slice(0, colonIdx).trim();
      const title = text.slice(colonIdx + 1).trim();
      if (boardName && title) {
        const prefixTarget = await this.findBoardTarget(userId, boardName);
        if (prefixTarget) return { ...prefixTarget, title };
      }
    }

    const defaultList = await this.getDefaultList(userId);
    if (!defaultList) return null;
    return { ...defaultList, title: text };
  }

  private async findBoardTarget(userId: string, boardName: string) {
    const [board] = await this.db
      .select({ id: boards.id, name: boards.name })
      .from(boards)
      .where(
        and(
          eq(boards.userId, userId),
          isNull(boards.archivedAt),
          sql`${boards.name} = ${boardName} COLLATE NOCASE`,
        ),
      )
      .limit(1);
    if (!board) return null;

    const [firstList] = await this.db
      .select({ id: lists.id, name: lists.name })
      .from(lists)
      .where(and(eq(lists.boardId, board.id), isNull(lists.archivedAt), eq(lists.isDone, false)))
      .orderBy(asc(lists.position))
      .limit(1);
    if (!firstList) return null;

    return {
      listId: firstList.id,
      listName: firstList.name,
      boardId: board.id,
      boardName: board.name,
    };
  }
}
