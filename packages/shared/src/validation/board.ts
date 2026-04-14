import { z } from 'zod';
import { listWithCardsDetailSchema } from './list.js';

export const createBoardSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

export const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export type Board = z.infer<typeof boardSchema>;

export const boardsResponseSchema = z.object({ boards: z.array(boardSchema) });
export const boardResponseSchema = z.object({ board: boardSchema });

export const boardDetailSchema = boardSchema.extend({
  lists: z.array(listWithCardsDetailSchema),
});
export type BoardDetail = z.infer<typeof boardDetailSchema>;
export const boardDetailResponseSchema = z.object({ board: boardDetailSchema });
