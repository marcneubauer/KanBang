import { eq, asc, desc, and, ne, isNull, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { lists, cards, cardLabels, checklists, checklistItems } from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import { allocateCardNumbers } from '../utils/card-number.js';
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

  /** Move a list (and its cards) to another board, appended after its active lists. */
  async moveToBoard(listId: string, targetBoardId: string) {
    const list = await this.getById(listId);
    if (!list) return null;
    if (list.boardId === targetBoardId) return list;

    const [lastList] = await this.db
      .select({ position: lists.position })
      .from(lists)
      .where(and(eq(lists.boardId, targetBoardId), isNull(lists.archivedAt)))
      .orderBy(desc(lists.position))
      .limit(1);
    const position = generateKeyBetween(lastList?.position ?? null, null);
    const now = new Date();

    return this.db.transaction((tx) => {
      // isDone resets: the Done designation belongs to the source board
      const [moved] = tx
        .update(lists)
        .set({ boardId: targetBoardId, position, isDone: false, updatedAt: now })
        .where(eq(lists.id, listId))
        .returning()
        .all();

      // Labels are board-scoped: drop assignments for every card in this list
      const cardRows = tx
        .select({ id: cards.id })
        .from(cards)
        .where(eq(cards.listId, listId))
        .orderBy(asc(cards.position))
        .all();
      if (cardRows.length > 0) {
        tx.delete(cardLabels)
          .where(inArray(cardLabels.cardId, cardRows.map((c) => c.id)))
          .run();

        // Card numbers are board-scoped: renumber from the target board's sequence
        const first = allocateCardNumbers(tx, targetBoardId, cardRows.length);
        if (first !== null) {
          cardRows.forEach((row, i) => {
            tx.update(cards).set({ number: first + i }).where(eq(cards.id, row.id)).run();
          });
        }
      }

      return moved ?? null;
    });
  }

  /** Duplicate a list and its active cards (labels + checklists included) on the same board. */
  async copy(listId: string) {
    const source = await this.getByIdWithCards(listId);
    if (!source) return null;

    const [lastList] = await this.db
      .select({ position: lists.position })
      .from(lists)
      .where(and(eq(lists.boardId, source.boardId), isNull(lists.archivedAt)))
      .orderBy(desc(lists.position))
      .limit(1);
    const position = generateKeyBetween(lastList?.position ?? null, null);
    const now = new Date();

    return this.db.transaction((tx) => {
      const newList = {
        id: nanoid(),
        name: `${source.name} (copy)`.slice(0, 100),
        boardId: source.boardId,
        position,
        isDone: false,
        cardLimit: source.cardLimit,
        createdAt: now,
        updatedAt: now,
      };
      tx.insert(lists).values(newList).run();

      const firstNumber = allocateCardNumbers(tx, source.boardId, source.cards.length);

      let prevCardKey: string | null = null;
      for (const [cardIndex, card] of source.cards.entries()) {
        prevCardKey = generateKeyBetween(prevCardKey, null);
        const newCardId = nanoid();
        tx.insert(cards)
          .values({
            id: newCardId,
            number: firstNumber !== null ? firstNumber + cardIndex : null,
            title: card.title,
            description: card.description,
            listId: newList.id,
            position: prevCardKey,
            isTemplate: card.isTemplate,
            coverType: card.coverType,
            coverValue: card.coverValue,
            completed: card.completed,
            completedAt: card.completedAt,
            dueDate: card.dueDate,
            createdAt: now,
            updatedAt: now,
            archivedAt: null,
          })
          .run();

        const labelRows = tx
          .select()
          .from(cardLabels)
          .where(eq(cardLabels.cardId, card.id))
          .all();
        for (const row of labelRows) {
          tx.insert(cardLabels).values({ cardId: newCardId, labelId: row.labelId }).run();
        }

        const sourceChecklists = tx
          .select()
          .from(checklists)
          .where(eq(checklists.cardId, card.id))
          .all();
        for (const cl of sourceChecklists) {
          const newChecklistId = nanoid();
          tx.insert(checklists)
            .values({
              id: newChecklistId,
              name: cl.name,
              cardId: newCardId,
              position: cl.position,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          const items = tx
            .select()
            .from(checklistItems)
            .where(eq(checklistItems.checklistId, cl.id))
            .all();
          for (const item of items) {
            tx.insert(checklistItems)
              .values({
                id: nanoid(),
                title: item.title,
                checklistId: newChecklistId,
                position: item.position,
                completed: item.completed,
                createdAt: now,
                updatedAt: now,
              })
              .run();
          }
        }
      }

      return newList;
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
