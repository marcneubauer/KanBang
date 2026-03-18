import { z } from 'zod';

export const createCardSchema = z.object({
  title: z.string().min(1).max(500).trim(),
  description: z.string().max(5000).optional(),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  description: z.string().max(5000).nullable().optional(),
  completed: z.boolean().optional(),
});

export const moveCardSchema = z.object({
  listId: z.string().min(1),
  position: z.string().min(1),
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
export type SearchCardsInput = z.infer<typeof searchCardsSchema>;
