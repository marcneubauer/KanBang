import { eq, asc, desc, and, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { lists, cards } from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import type { CreateListInput, UpdateListInput } from '@kanbang/shared/validation/list.js';

export class ListService {
  constructor(private db: Database) {}

  async create(boardId: string, input: CreateListInput) {
    // Get the last active list position to append after it
    const [lastList] = await this.db
      .select({ position: lists.position })
      .from(lists)
      .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
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

  async archive(listId: string) {
    const [list] = await this.db
      .update(lists)
      .set({ archivedAt: new Date() })
      .where(eq(lists.id, listId))
      .returning();

    return !!list;
  }

  async unarchive(listId: string) {
    const [list] = await this.db
      .update(lists)
      .set({ archivedAt: null })
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

  async getByIdWithCards(listId: string) {
    const list = await this.getById(listId);
    if (!list) return null;

    const listCards = await this.db
      .select()
      .from(cards)
      .where(and(eq(cards.listId, listId), isNull(cards.archivedAt)))
      .orderBy(asc(cards.position));

    return { ...list, cards: listCards };
  }

  async getBoardId(listId: string): Promise<string | null> {
    const list = await this.getById(listId);
    return list?.boardId ?? null;
  }
}
