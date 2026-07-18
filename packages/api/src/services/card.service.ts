import { eq, and, or, like, desc, asc, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { cards, lists, cardLabels, checklists, checklistItems } from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import type { CreateCardInput, UpdateCardInput, CopyCardInput } from '@kanbang/shared/validation/card.js';
import type { ListService } from './list.service.js';

export class CardService {
  private listService?: ListService;

  constructor(private db: Database) {}

  setListService(listService: ListService) {
    this.listService = listService;
  }

  async create(listId: string, input: CreateCardInput) {
    // Get the last active card position to append after it
    const [lastCard] = await this.db
      .select({ position: cards.position })
      .from(cards)
      .where(and(eq(cards.listId, listId), isNull(cards.archivedAt)))
      .orderBy(desc(cards.position))
      .limit(1);

    const position = generateKeyBetween(lastCard?.position ?? null, null);
    const now = new Date();

    const [card] = await this.db
      .insert(cards)
      .values({
        id: nanoid(),
        title: input.title,
        description: input.description ?? null,
        listId,
        position,
        dueDate: input.dueDate ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return card;
  }

  async update(cardId: string, input: UpdateCardInput) {
    const updates: Partial<typeof cards.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate;

    if (input.completed !== undefined) {
      updates.completed = input.completed;

      if (input.completed) {
        updates.completedAt = new Date();

        // Auto-move to Done list if one exists
        if (this.listService) {
          const currentListId = await this.getListId(cardId);
          if (currentListId) {
            const boardId = await this.listService.getBoardId(currentListId);
            if (boardId) {
              const doneList = await this.listService.getDoneList(boardId);
              if (doneList && currentListId !== doneList.id) {
                // Get last card position in the Done list
                const [lastCard] = await this.db
                  .select({ position: cards.position })
                  .from(cards)
                  .where(and(eq(cards.listId, doneList.id), isNull(cards.archivedAt)))
                  .orderBy(desc(cards.position))
                  .limit(1);

                updates.listId = doneList.id;
                updates.position = generateKeyBetween(lastCard?.position ?? null, null);
              }
            }
          }
        }
      } else {
        updates.completedAt = null;
      }
    }

    const [card] = await this.db
      .update(cards)
      .set(updates)
      .where(eq(cards.id, cardId))
      .returning();

    return card ?? null;
  }

  async move(cardId: string, listId: string, position: string) {
    const current = await this.getById(cardId);

    const [card] = await this.db
      .update(cards)
      .set({ listId, position, updatedAt: new Date() })
      .where(eq(cards.id, cardId))
      .returning();

    if (!card) return null;

    // Labels are board-scoped: moving across boards drops label assignments
    if (current && current.listId !== listId) {
      const [oldBoard] = await this.db
        .select({ boardId: lists.boardId })
        .from(lists)
        .where(eq(lists.id, current.listId))
        .limit(1);
      const [newBoard] = await this.db
        .select({ boardId: lists.boardId })
        .from(lists)
        .where(eq(lists.id, listId))
        .limit(1);
      if (oldBoard && newBoard && oldBoard.boardId !== newBoard.boardId) {
        await this.db.delete(cardLabels).where(eq(cardLabels.cardId, cardId));
      }
    }

    return card;
  }

  /** Duplicate a card onto a list (same or different board), appended at the end. */
  async copy(cardId: string, input: CopyCardInput) {
    const source = await this.getById(cardId);
    if (!source) return null;

    const [sourceList] = await this.db
      .select({ boardId: lists.boardId })
      .from(lists)
      .where(eq(lists.id, source.listId))
      .limit(1);
    const [targetList] = await this.db
      .select({ boardId: lists.boardId })
      .from(lists)
      .where(eq(lists.id, input.listId))
      .limit(1);
    if (!targetList) return null;
    const sameBoard = sourceList?.boardId === targetList.boardId;

    const [lastCard] = await this.db
      .select({ position: cards.position })
      .from(cards)
      .where(and(eq(cards.listId, input.listId), isNull(cards.archivedAt)))
      .orderBy(desc(cards.position))
      .limit(1);
    const position = generateKeyBetween(lastCard?.position ?? null, null);
    const now = new Date();

    return this.db.transaction((tx) => {
      const newCard = {
        id: nanoid(),
        title: source.title,
        description: source.description,
        listId: input.listId,
        position,
        completed: source.completed,
        completedAt: source.completedAt,
        dueDate: source.dueDate,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      tx.insert(cards).values(newCard).run();

      // Labels only survive a same-board copy (they're board-scoped)
      if (input.keepLabels && sameBoard) {
        const labelRows = tx
          .select()
          .from(cardLabels)
          .where(eq(cardLabels.cardId, cardId))
          .all();
        for (const row of labelRows) {
          tx.insert(cardLabels).values({ cardId: newCard.id, labelId: row.labelId }).run();
        }
      }

      if (input.keepChecklists) {
        const sourceChecklists = tx
          .select()
          .from(checklists)
          .where(eq(checklists.cardId, cardId))
          .all();
        for (const cl of sourceChecklists) {
          const newChecklistId = nanoid();
          tx.insert(checklists)
            .values({
              id: newChecklistId,
              name: cl.name,
              cardId: newCard.id,
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

      return newCard;
    });
  }

  async archive(cardId: string) {
    const [card] = await this.db
      .update(cards)
      .set({ archivedAt: new Date() })
      .where(eq(cards.id, cardId))
      .returning();

    return !!card;
  }

  async unarchive(cardId: string) {
    const [card] = await this.db
      .update(cards)
      .set({ archivedAt: null })
      .where(eq(cards.id, cardId))
      .returning();

    return !!card;
  }

  async getById(cardId: string) {
    const [card] = await this.db
      .select()
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);

    return card ?? null;
  }

  async getListId(cardId: string): Promise<string | null> {
    const card = await this.getById(cardId);
    return card?.listId ?? null;
  }

  async search(boardId: string, options: { q?: string; completed?: boolean }) {
    const conditions = [eq(lists.boardId, boardId), isNull(lists.archivedAt), isNull(cards.archivedAt)];

    if (options.q) {
      const pattern = `%${options.q}%`;
      conditions.push(or(like(cards.title, pattern), like(cards.description, pattern))!);
    }

    if (options.completed !== undefined) {
      conditions.push(eq(cards.completed, options.completed));
    }

    const results = await this.db
      .select({
        id: cards.id,
        title: cards.title,
        description: cards.description,
        listId: cards.listId,
        listName: lists.name,
        position: cards.position,
        completed: cards.completed,
        dueDate: cards.dueDate,
        createdAt: cards.createdAt,
        updatedAt: cards.updatedAt,
      })
      .from(cards)
      .innerJoin(lists, eq(cards.listId, lists.id))
      .where(and(...conditions))
      .orderBy(asc(lists.position), asc(cards.position));

    return results;
  }
}
