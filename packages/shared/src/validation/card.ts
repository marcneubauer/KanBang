import { z } from 'zod';
import { checklistProgressSchema } from './checklist.js';

export const cardSchema = z.object({
  id: z.string(),
  number: z.number().int().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  listId: z.string(),
  position: z.string(),
  completed: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  dueDate: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export type Card = z.infer<typeof cardSchema>;
export const cardResponseSchema = z.object({ card: cardSchema });
export const cardsResponseSchema = z.object({ cards: z.array(cardSchema) });

export const cardWithProgressSchema = cardSchema.extend({
  checklistProgress: checklistProgressSchema,
  labelIds: z.array(z.string()),
  commentCount: z.number(),
});
export type CardWithProgress = z.infer<typeof cardWithProgressSchema>;

export const createCardSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(5000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  description: z.string().max(5000).nullable().optional(),
  completed: z.boolean().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const moveCardSchema = z.object({
  listId: z.string().min(1),
  position: z.string().min(1),
});

export const copyCardSchema = z.object({
  listId: z.string().min(1),
  keepChecklists: z.boolean().default(true),
  keepLabels: z.boolean().default(true),
});

export const searchCardsSchema = z.object({
  q: z.string().max(500).optional(),
  completed: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
export type CopyCardInput = z.infer<typeof copyCardSchema>;
export type SearchCardsInput = z.infer<typeof searchCardsSchema>;
