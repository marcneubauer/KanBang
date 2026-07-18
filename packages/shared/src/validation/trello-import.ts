import { z } from 'zod';

/**
 * Lenient subset of Trello's per-board JSON export (Menu → Print and export →
 * Export as JSON). Unknown fields are ignored; missing optionals get defaults.
 */

const trelloListSchema = z.object({
  id: z.string(),
  name: z.string(),
  closed: z.boolean().default(false),
  pos: z.number().default(0),
});

const trelloLabelSchema = z.object({
  id: z.string(),
  name: z.string().default(''),
  color: z.string().nullable().default(null),
});

const trelloCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  desc: z.string().default(''),
  idList: z.string(),
  pos: z.number().default(0),
  closed: z.boolean().default(false),
  due: z.string().nullable().default(null),
  dueComplete: z.boolean().default(false),
  idLabels: z.array(z.string()).default([]),
});

const trelloCheckItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string().default('incomplete'),
  pos: z.number().default(0),
});

const trelloChecklistSchema = z.object({
  id: z.string(),
  name: z.string(),
  idCard: z.string(),
  pos: z.number().default(0),
  checkItems: z.array(trelloCheckItemSchema).default([]),
});

export const trelloBoardExportSchema = z.object({
  name: z.string().min(1),
  lists: z.array(trelloListSchema).default([]),
  cards: z.array(trelloCardSchema).default([]),
  labels: z.array(trelloLabelSchema).default([]),
  checklists: z.array(trelloChecklistSchema).default([]),
});

export type TrelloBoardExport = z.infer<typeof trelloBoardExportSchema>;
export type TrelloList = z.infer<typeof trelloListSchema>;
export type TrelloCard = z.infer<typeof trelloCardSchema>;

export interface TrelloImportSummary {
  boardId: string;
  boardName: string;
  lists: number;
  cards: number;
  labels: number;
  checklists: number;
  checklistItems: number;
}
