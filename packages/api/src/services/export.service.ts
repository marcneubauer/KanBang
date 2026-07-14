import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { boards, lists, cards, checklists, checklistItems } from '../db/schema.js';

export class ExportService {
  constructor(private db: Database) {}

  /** Full nested export of all the user's data, including archived items. */
  async exportUserData(userId: string) {
    const userBoards = await this.db
      .select()
      .from(boards)
      .where(eq(boards.userId, userId))
      .orderBy(asc(boards.createdAt));

    const boardIds = userBoards.map((b) => b.id);
    const userLists = boardIds.length
      ? await this.db
        .select()
        .from(lists)
        .where(inArray(lists.boardId, boardIds))
        .orderBy(asc(lists.position))
      : [];

    const listIds = userLists.map((l) => l.id);
    const userCards = listIds.length
      ? await this.db
        .select()
        .from(cards)
        .where(inArray(cards.listId, listIds))
        .orderBy(asc(cards.position))
      : [];

    const cardIds = userCards.map((c) => c.id);
    const userChecklists = cardIds.length
      ? await this.db
        .select()
        .from(checklists)
        .where(inArray(checklists.cardId, cardIds))
        .orderBy(asc(checklists.position))
      : [];

    const checklistIds = userChecklists.map((c) => c.id);
    const userItems = checklistIds.length
      ? await this.db
        .select()
        .from(checklistItems)
        .where(inArray(checklistItems.checklistId, checklistIds))
        .orderBy(asc(checklistItems.position))
      : [];

    return userBoards.map((board) => ({
      ...board,
      lists: userLists
        .filter((list) => list.boardId === board.id)
        .map((list) => ({
          ...list,
          cards: userCards
            .filter((card) => card.listId === list.id)
            .map((card) => ({
              ...card,
              checklists: userChecklists
                .filter((checklist) => checklist.cardId === card.id)
                .map((checklist) => ({
                  ...checklist,
                  items: userItems.filter((item) => item.checklistId === checklist.id),
                })),
            })),
        })),
    }));
  }
}
