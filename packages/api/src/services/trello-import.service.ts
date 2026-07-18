import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import {
  boards,
  lists,
  cards,
  labels,
  cardLabels,
  checklists,
  checklistItems,
} from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import type {
  TrelloBoardExport,
  TrelloImportSummary,
} from '@kanbang/shared/validation/trello-import.js';

/** Trello label colors → the KanBang palette (shared LABEL_COLORS). */
const TRELLO_COLOR_MAP: Record<string, string> = {
  green: '#61bd4f',
  yellow: '#f2d600',
  orange: '#ff9f1a',
  red: '#eb5a46',
  purple: '#c377e0',
  blue: '#0079bf',
  sky: '#00c2e0',
  lime: '#51e898',
  pink: '#ff78cb',
  black: '#344563',
};
const DEFAULT_LABEL_COLOR = '#344563';

function mapTrelloColor(color: string | null): string {
  if (!color) return DEFAULT_LABEL_COLOR;
  // Newer exports use variants like "green_dark" / "green_light"
  const base = color.split('_')[0];
  return TRELLO_COLOR_MAP[base] ?? DEFAULT_LABEL_COLOR;
}

function parseDueDate(due: string | null): Date | null {
  if (!due) return null;
  const date = new Date(due);
  return Number.isNaN(date.getTime()) ? null : date;
}

export class TrelloImportService {
  constructor(private db: Database) {}

  /** Import one Trello board export as a new KanBang board. Runs in a single transaction. */
  importBoard(userId: string, data: TrelloBoardExport): TrelloImportSummary {
    const now = new Date();

    return this.db.transaction((tx) => {
      const boardId = nanoid();
      tx.insert(boards)
        .values({
          id: boardId,
          name: data.name.slice(0, 100),
          userId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Lists: keep Trello ordering (numeric pos → sequential fractional keys)
      const listIdMap = new Map<string, string>();
      let prevListKey: string | null = null;
      for (const trelloList of [...data.lists].sort((a, b) => a.pos - b.pos)) {
        const id = nanoid();
        listIdMap.set(trelloList.id, id);
        prevListKey = generateKeyBetween(prevListKey, null);
        tx.insert(lists)
          .values({
            id,
            name: trelloList.name.slice(0, 100) || '(untitled)',
            boardId,
            position: prevListKey,
            createdAt: now,
            updatedAt: now,
            archivedAt: trelloList.closed ? now : null,
          })
          .run();
      }

      // Labels: only those that are named or actually used by a card
      const usedLabelIds = new Set(data.cards.flatMap((c) => c.idLabels));
      const labelIdMap = new Map<string, string>();
      let importedLabels = 0;
      for (const trelloLabel of data.labels) {
        if (!trelloLabel.name && !usedLabelIds.has(trelloLabel.id)) continue;
        const id = nanoid();
        labelIdMap.set(trelloLabel.id, id);
        tx.insert(labels)
          .values({
            id,
            name: trelloLabel.name.slice(0, 50),
            color: mapTrelloColor(trelloLabel.color),
            boardId,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        importedLabels++;
      }

      // Cards, grouped per list so fractional keys restart per list
      const cardIdMap = new Map<string, string>();
      let importedCards = 0;
      for (const trelloListId of listIdMap.keys()) {
        const listCards = data.cards
          .filter((c) => c.idList === trelloListId)
          .sort((a, b) => a.pos - b.pos);

        let prevCardKey: string | null = null;
        for (const trelloCard of listCards) {
          const id = nanoid();
          cardIdMap.set(trelloCard.id, id);
          prevCardKey = generateKeyBetween(prevCardKey, null);
          tx.insert(cards)
            .values({
              id,
              title: trelloCard.name.slice(0, 500) || '(untitled)',
              description: trelloCard.desc ? trelloCard.desc.slice(0, 5000) : null,
              listId: listIdMap.get(trelloListId)!,
              position: prevCardKey,
              completed: trelloCard.dueComplete,
              completedAt: trelloCard.dueComplete ? now : null,
              dueDate: parseDueDate(trelloCard.due),
              createdAt: now,
              updatedAt: now,
              archivedAt: trelloCard.closed ? now : null,
            })
            .run();
          importedCards++;

          for (const trelloLabelId of trelloCard.idLabels) {
            const labelId = labelIdMap.get(trelloLabelId);
            if (labelId) {
              tx.insert(cardLabels).values({ cardId: id, labelId }).run();
            }
          }
        }
      }

      // Checklists + items, grouped per card
      let importedChecklists = 0;
      let importedItems = 0;
      const checklistsByCard = new Map<string, typeof data.checklists>();
      for (const checklist of data.checklists) {
        const cardId = cardIdMap.get(checklist.idCard);
        if (!cardId) continue;
        const group = checklistsByCard.get(cardId) ?? [];
        group.push(checklist);
        checklistsByCard.set(cardId, group);
      }

      for (const [cardId, cardChecklists] of checklistsByCard) {
        let prevChecklistKey: string | null = null;
        for (const trelloChecklist of cardChecklists.sort((a, b) => a.pos - b.pos)) {
          const checklistId = nanoid();
          prevChecklistKey = generateKeyBetween(prevChecklistKey, null);
          tx.insert(checklists)
            .values({
              id: checklistId,
              name: trelloChecklist.name.slice(0, 100) || '(untitled)',
              cardId,
              position: prevChecklistKey,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          importedChecklists++;

          let prevItemKey: string | null = null;
          for (const item of [...trelloChecklist.checkItems].sort((a, b) => a.pos - b.pos)) {
            prevItemKey = generateKeyBetween(prevItemKey, null);
            tx.insert(checklistItems)
              .values({
                id: nanoid(),
                title: item.name.slice(0, 500) || '(untitled)',
                checklistId,
                position: prevItemKey,
                completed: item.state === 'complete',
                createdAt: now,
                updatedAt: now,
              })
              .run();
            importedItems++;
          }
        }
      }

      return {
        boardId,
        boardName: data.name.slice(0, 100),
        lists: listIdMap.size,
        cards: importedCards,
        labels: importedLabels,
        checklists: importedChecklists,
        checklistItems: importedItems,
      };
    });
  }
}
