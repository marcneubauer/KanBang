import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { comments } from '../db/schema.js';
import type { CreateCommentInput, UpdateCommentInput } from '@kanbang/shared/validation/comment.js';

export class CommentService {
  constructor(private db: Database) {}

  async listByCard(cardId: string) {
    return this.db
      .select()
      .from(comments)
      .where(eq(comments.cardId, cardId))
      .orderBy(desc(comments.createdAt), desc(comments.id));
  }

  async create(cardId: string, input: CreateCommentInput) {
    const now = new Date();
    const [comment] = await this.db
      .insert(comments)
      .values({
        id: nanoid(),
        body: input.body,
        cardId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return comment;
  }

  async update(commentId: string, input: UpdateCommentInput) {
    const [comment] = await this.db
      .update(comments)
      .set({ body: input.body, updatedAt: new Date() })
      .where(eq(comments.id, commentId))
      .returning();

    return comment ?? null;
  }

  async delete(commentId: string) {
    const [comment] = await this.db
      .delete(comments)
      .where(eq(comments.id, commentId))
      .returning();

    return !!comment;
  }

  async getCardId(commentId: string): Promise<string | null> {
    const [comment] = await this.db
      .select({ cardId: comments.cardId })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    return comment?.cardId ?? null;
  }
}
