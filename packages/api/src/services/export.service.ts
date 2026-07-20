import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { boards, lists, cards, checklists, checklistItems, labels, cardLabels, comments, attachments } from '../db/schema.js';

/** Attachment fields included in exports (no userId; storageKey maps to files/ in the zip archive). */
function attachmentMetadata(att: typeof attachments.$inferSelect) {
  return {
    id: att.id,
    cardId: att.cardId,
    filename: att.filename,
    mimeType: att.mimeType,
    sizeBytes: att.sizeBytes,
    width: att.width,
    height: att.height,
    storageKey: att.storageKey,
    createdAt: att.createdAt,
  };
}

export class ExportService {
  constructor(private db: Database) {}

  /** All attachment rows owned by the user (card attachments + board backgrounds). */
  async listAttachments(userId: string) {
    return this.db
      .select()
      .from(attachments)
      .where(eq(attachments.userId, userId))
      .orderBy(asc(attachments.createdAt));
  }

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

    const userLabels = boardIds.length
      ? await this.db
        .select()
        .from(labels)
        .where(inArray(labels.boardId, boardIds))
        .orderBy(asc(labels.createdAt))
      : [];

    const userCardLabels = cardIds.length
      ? await this.db
        .select()
        .from(cardLabels)
        .where(inArray(cardLabels.cardId, cardIds))
      : [];

    const userComments = cardIds.length
      ? await this.db
        .select()
        .from(comments)
        .where(inArray(comments.cardId, cardIds))
        .orderBy(asc(comments.createdAt))
      : [];

    const userAttachments = await this.listAttachments(userId);
    const attachmentById = new Map(userAttachments.map((a) => [a.id, a]));

    return userBoards.map((board) => ({
      ...board,
      backgroundImage:
        board.backgroundType === 'image' && board.backgroundValue
          ? (() => {
            const att = attachmentById.get(board.backgroundValue);
            return att ? attachmentMetadata(att) : null;
          })()
          : null,
      labels: userLabels.filter((label) => label.boardId === board.id),
      lists: userLists
        .filter((list) => list.boardId === board.id)
        .map((list) => ({
          ...list,
          cards: userCards
            .filter((card) => card.listId === list.id)
            .map((card) => ({
              ...card,
              labelIds: userCardLabels
                .filter((cl) => cl.cardId === card.id)
                .map((cl) => cl.labelId),
              attachments: userAttachments
                .filter((a) => a.cardId === card.id)
                .map(attachmentMetadata),
              comments: userComments.filter((comment) => comment.cardId === card.id),
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
