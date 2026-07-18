import { eq, asc, desc, and, ne, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { lists, cards } from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import type { CreateListInput, UpdateListInput, SortListInput } from '@kanbang/shared/validation/list.js';

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
    const updates: Partial<typeof lists.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.cardLimit !== undefined) updates.cardLimit = input.cardLimit;

    const [list] = await this.db
      .update(lists)
      .set(updates)
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

  async archive(listId: string): Promise<{ ok: boolean; error?: string }> {
    // Prevent archiving a list that is designated as Done
    const existing = await this.getById(listId);
    if (existing?.isDone) {
      return { ok: false, error: 'Remove Done status before archiving' };
    }

    const [list] = await this.db
      .update(lists)
      .set({ archivedAt: new Date() })
      .where(eq(lists.id, listId))
      .returning();

    return { ok: !!list };
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

  async setDone(listId: string, isDone: boolean) {
    if (isDone) {
      // Get the board for this list
      const [list] = await this.db.select().from(lists).where(eq(lists.id, listId));
      if (!list) return null;

      // Clear isDone on all other lists in the same board
      await this.db
        .update(lists)
        .set({ isDone: false, updatedAt: new Date() })
        .where(and(eq(lists.boardId, list.boardId), ne(lists.id, listId)));
    }

    const [updated] = await this.db
      .update(lists)
      .set({ isDone, updatedAt: new Date() })
      .where(eq(lists.id, listId))
      .returning();

    return updated ?? null;
  }

  /** Sort a list's active cards by name/dueDate/createdAt, rewriting their fractional positions. */
  async sortCards(listId: string, input: SortListInput) {
    const listCards = await this.db
      .select()
      .from(cards)
      .where(and(eq(cards.listId, listId), isNull(cards.archivedAt)))
      .orderBy(asc(cards.position));

    const dir = input.direction === 'desc' ? -1 : 1;
    const sorted = [...listCards].sort((a, b) => {
      if (input.by === 'name') {
        return dir * a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      if (input.by === 'dueDate') {
        // Cards without a due date always sink to the bottom
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return dir * (a.dueDate.getTime() - b.dueDate.getTime());
      }
      return dir * (a.createdAt.getTime() - b.createdAt.getTime());
    });

    const now = new Date();
    return this.db.transaction((tx) => {
      let prev: string | null = null;
      const result = [];
      for (const card of sorted) {
        prev = generateKeyBetween(prev, null);
        tx.update(cards)
          .set({ position: prev, updatedAt: now })
          .where(eq(cards.id, card.id))
          .run();
        result.push({ ...card, position: prev, updatedAt: now });
      }
      return result;
    });
  }

  async getDoneList(boardId: string) {
    const [list] = await this.db
      .select()
      .from(lists)
      .where(and(eq(lists.boardId, boardId), eq(lists.isDone, true), isNull(lists.archivedAt)))
      .limit(1);

    return list ?? null;
  }
}
