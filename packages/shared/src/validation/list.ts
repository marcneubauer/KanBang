import { z } from 'zod';

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
