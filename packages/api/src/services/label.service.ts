import { and, asc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { labels, cardLabels } from '../db/schema.js';
import type { CreateLabelInput, UpdateLabelInput } from '@kanbang/shared/validation/label.js';

export class LabelService {
  constructor(private db: Database) {}

  async create(boardId: string, input: CreateLabelInput) {
    const now = new Date();
    const [label] = await this.db
      .insert(labels)
      .values({
        id: nanoid(),
        name: input.name,
        color: input.color,
        boardId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return label;
  }

  async getByBoard(boardId: string) {
    return this.db
      .select()
      .from(labels)
      .where(eq(labels.boardId, boardId))
      .orderBy(asc(labels.createdAt));
  }

  async getBoardId(labelId: string) {
    const [label] = await this.db
      .select({ boardId: labels.boardId })
      .from(labels)
      .where(eq(labels.id, labelId))
      .limit(1);

    return label?.boardId ?? null;
  }

  async update(labelId: string, input: UpdateLabelInput) {
    const [label] = await this.db
      .update(labels)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(labels.id, labelId))
      .returning();

    return label ?? null;
  }

  async delete(labelId: string) {
    const result = await this.db.delete(labels).where(eq(labels.id, labelId)).returning();
    return result.length > 0;
  }

  async addToCard(cardId: string, labelId: string) {
    await this.db
      .insert(cardLabels)
      .values({ cardId, labelId })
      .onConflictDoNothing();
  }

  async removeFromCard(cardId: string, labelId: string) {
    await this.db
      .delete(cardLabels)
      .where(and(eq(cardLabels.cardId, cardId), eq(cardLabels.labelId, labelId)));
  }

  /** Map of cardId -> labelIds for the given cards. */
  async getLabelIdsByCards(cardIds: string[]) {
    if (cardIds.length === 0) return new Map<string, string[]>();

    const rows = await this.db
      .select()
      .from(cardLabels)
      .where(inArray(cardLabels.cardId, cardIds));

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const existing = map.get(row.cardId);
      if (existing) {
        existing.push(row.labelId);
      } else {
        map.set(row.cardId, [row.labelId]);
      }
    }
    return map;
  }
}
