import { eq, and, asc, isNull, isNotNull, lte, count, sql, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { boards, lists, cards, checklists, checklistItems, labels, cardLabels, comments } from '../db/schema.js';
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

    const listIds = boardLists.map((l) => l.id);
    const boardCards = listIds.length
      ? await this.db
        .select()
        .from(cards)
        .where(and(inArray(cards.listId, listIds), isNull(cards.archivedAt)))
        .orderBy(asc(cards.position))
      : [];

    const cardIds = boardCards.map((c) => c.id);
    const progressRows = cardIds.length
      ? await this.db
        .select({
          cardId: checklists.cardId,
          total: count(),
          completed: count(sql`CASE WHEN ${checklistItems.completed} = 1 THEN 1 END`),
        })
        .from(checklistItems)
        .innerJoin(checklists, eq(checklistItems.checklistId, checklists.id))
        .where(inArray(checklists.cardId, cardIds))
        .groupBy(checklists.cardId)
      : [];

    const progressByCard = new Map(progressRows.map((r) => [r.cardId, r]));

    const commentRows = cardIds.length
      ? await this.db
        .select({ cardId: comments.cardId, total: count() })
        .from(comments)
        .where(inArray(comments.cardId, cardIds))
        .groupBy(comments.cardId)
      : [];
    const commentCountByCard = new Map(commentRows.map((r) => [r.cardId, r.total]));

    const boardLabels = await this.db
      .select()
      .from(labels)
      .where(eq(labels.boardId, boardId))
      .orderBy(asc(labels.createdAt));

    const labelRows = cardIds.length
      ? await this.db
        .select()
        .from(cardLabels)
        .where(inArray(cardLabels.cardId, cardIds))
      : [];

    const labelIdsByCard = new Map<string, string[]>();
    for (const row of labelRows) {
      const existing = labelIdsByCard.get(row.cardId);
      if (existing) {
        existing.push(row.labelId);
      } else {
        labelIdsByCard.set(row.cardId, [row.labelId]);
      }
    }

    const listsWithCards = boardLists.map((list) => ({
      ...list,
      cards: boardCards
        .filter((card) => card.listId === list.id)
        .map((card) => {
          const progress = progressByCard.get(card.id);
          return {
            ...card,
            checklistProgress: {
              total: progress?.total ?? 0,
              completed: progress?.completed ?? 0,
            },
            labelIds: labelIdsByCard.get(card.id) ?? [],
            commentCount: commentCountByCard.get(card.id) ?? 0,
          };
        }),
    }));

    return { ...board, lists: listsWithCards, labels: boardLabels };
  }

  /** Archive cards completed 3+ days ago in the board's Done list. */
  async archiveStaleDoneCards(boardId: string) {
    const ARCHIVE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - ARCHIVE_AFTER_MS);

    const doneListIds = this.db
      .select({ id: lists.id })
      .from(lists)
      .where(and(eq(lists.boardId, boardId), eq(lists.isDone, true)));

    await this.db
      .update(cards)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(cards.completed, true),
          isNotNull(cards.completedAt),
          lte(cards.completedAt, cutoff),
          isNull(cards.archivedAt),
          inArray(cards.listId, doneListIds),
        ),
      );
  }

  async update(boardId: string, input: UpdateBoardInput) {
    const updates: Partial<typeof boards.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.cardAgingDays !== undefined) updates.cardAgingDays = input.cardAgingDays;
    if (input.coversEnabled !== undefined) updates.coversEnabled = input.coversEnabled;
    if (input.backgroundType !== undefined) updates.backgroundType = input.backgroundType;
    if (input.backgroundValue !== undefined) updates.backgroundValue = input.backgroundValue;

    const [board] = await this.db
      .update(boards)
      .set(updates)
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

  async getOwnerId(boardId: string) {
    const [board] = await this.db
      .select({ userId: boards.userId })
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);

    return board?.userId ?? null;
  }
}
