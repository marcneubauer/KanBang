import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { lists } from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import type { CreateListInput, UpdateListInput } from '@kanbang/shared/validation/list.js';

export class ListService {
  constructor(private db: Database) {}

  async create(boardId: string, input: CreateListInput) {
    // Get the last list position to append after it
    const [lastList] = await this.db
      .select({ position: lists.position })
      .from(lists)
      .where(eq(lists.boardId, boardId))
      .orderBy(desc(lists.position))
      .limit(1);

    const position = generateKeyBetween(lastList?.position ?? null, null);
    const now = new Date();

    const [list] = await this.db
      .insert(lists)
      .values({
        id: nanoid(),
        name: input.name,
        boardId,
        position,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return list;
  }

  async update(listId: string, input: UpdateListInput) {
    const [list] = await this.db
      .update(lists)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(lists.id, listId))
      .returning();

    return list ?? null;
  }

  async reorder(listId: string, position: string) {
    const [list] = await this.db
      .update(lists)
      .set({ position, updatedAt: new Date() })
      .where(eq(lists.id, listId))
      .returning();

    return list ?? null;
  }

  async delete(listId: string) {
    const [list] = await this.db
      .delete(lists)
      .where(eq(lists.id, listId))
      .returning();

    return !!list;
  }

  async getById(listId: string) {
    const [list] = await this.db
      .select()
      .from(lists)
      .where(eq(lists.id, listId))
      .limit(1);

    return list ?? null;
  }

  async getBoardId(listId: string): Promise<string | null> {
    const list = await this.getById(listId);
    return list?.boardId ?? null;
  }
}
