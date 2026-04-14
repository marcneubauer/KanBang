import { z } from 'zod';
import { cardSchema } from './card.js';

export const listSchema = z.object({
  id: z.string(),
  name: z.string(),
  boardId: z.string(),
  position: z.string(),
  isDone: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export type List = z.infer<typeof listSchema>;

export const listWithCardsSchema = listSchema.extend({
  cards: z.array(cardSchema),
});

export type ListWithCards = z.infer<typeof listWithCardsSchema>;

export const listResponseSchema = z.object({ list: listSchema });
export const listWithCardsResponseSchema = z.object({ list: listWithCardsSchema });

export const createListSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const updateListSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const reorderListSchema = z.object({
  position: z.string().min(1),
});

export const setDoneListSchema = z.object({
  isDone: z.boolean(),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type ReorderListInput = z.infer<typeof reorderListSchema>;
export type SetDoneListInput = z.infer<typeof setDoneListSchema>;
