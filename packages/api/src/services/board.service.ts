import { eq, and, asc, isNull, isNotNull, count, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { boards, lists, cards, checklists, checklistItems } from '../db/schema.js';
import type { CreateBoardInput, UpdateBoardInput } from '@kanbang/shared/validation/board.js';

export class BoardService {
  constructor(private db: Database) {}

  async create(userId: string, input: CreateBoardInput) {
    const now = new Date();
    const [board] = await this.db
      .insert(boards)
      .values({
        id: nanoid(),
        name: input.name,
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return board;
  }

  async getAll(userId: string, archived = false) {
    return this.db
      .select()
      .from(boards)
      .where(
        and(
          eq(boards.userId, userId),
          archived ? isNotNull(boards.archivedAt) : isNull(boards.archivedAt),
        ),
      )
      .orderBy(asc(boards.createdAt));
  }

  async getById(boardId: string) {
    const [board] = await this.db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);

    if (!board) return null;

    const boardLists = await this.db
      .select()
      .from(lists)
      .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
      .orderBy(asc(lists.position));

    const listsWithCards = await Promise.all(
      boardLists.map(async (list) => {
        const listCards = await this.db
          .select()
          .from(cards)
          .where(and(eq(cards.listId, list.id), isNull(cards.archivedAt)))
          .orderBy(asc(cards.position));

        const cardsWithProgress = await Promise.all(
          listCards.map(async (card) => {
            const [progress] = await this.db
              .select({
                total: count(),
                completed: count(sql`CASE WHEN ${checklistItems.completed} = 1 THEN 1 END`),
              })
              .from(checklistItems)
              .innerJoin(checklists, eq(checklistItems.checklistId, checklists.id))
              .where(eq(checklists.cardId, card.id));

            return {
              ...card,
              checklistProgress: {
                total: progress?.total ?? 0,
                completed: progress?.completed ?? 0,
              },
            };
          }),
        );

        return { ...list, cards: cardsWithProgress };
      }),
    );

    return { ...board, lists: listsWithCards };
  }

  async update(boardId: string, input: UpdateBoardInput) {
    const [board] = await this.db
      .update(boards)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(boards.id, boardId))
      .returning();

    return board ?? null;
  }

  async archive(boardId: string) {
    const [board] = await this.db
      .update(boards)
      .set({ archivedAt: new Date() })
      .where(eq(boards.id, boardId))
      .returning();

    return !!board;
  }

  async unarchive(boardId: string) {
    const [board] = await this.db
      .update(boards)
      .set({ archivedAt: null })
      .where(eq(boards.id, boardId))
      .returning();

    return !!board;
  }

  async getArchivedItems(boardId: string) {
    const archivedLists = await this.db
      .select()
      .from(lists)
      .where(and(eq(lists.boardId, boardId), isNotNull(lists.archivedAt)))
      .orderBy(asc(lists.position));

    const archivedListsWithCards = await Promise.all(
      archivedLists.map(async (list) => {
        const listCards = await this.db
          .select()
          .from(cards)
          .where(eq(cards.listId, list.id))
          .orderBy(asc(cards.position));

        return { ...list, cards: listCards };
      }),
    );

    const archivedCards = await this.db
      .select({
        id: cards.id,
        title: cards.title,
        completed: cards.completed,
        listId: cards.listId,
        listName: lists.name,
        position: cards.position,
        archivedAt: cards.archivedAt,
      })
      .from(cards)
      .innerJoin(lists, eq(cards.listId, lists.id))
      .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt), isNotNull(cards.archivedAt)))
      .orderBy(asc(lists.position), asc(cards.position));

    return { archivedLists: archivedListsWithCards, archivedCards };
  }

  async isOwner(boardId: string, userId: string) {
    const [board] = await this.db
      .select({ userId: boards.userId })
      .from(boards)
      .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
      .limit(1);

    return !!board;
  }
}
