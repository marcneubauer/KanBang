import { z } from 'zod';

export const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  checklistId: z.string(),
  position: z.string(),
  completed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const checklistSchema = z.object({
  id: z.string(),
  name: z.string(),
  cardId: z.string(),
  position: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  items: z.array(checklistItemSchema),
});

export type Checklist = z.infer<typeof checklistSchema>;

export const checklistProgressSchema = z.object({
  total: z.number(),
  completed: z.number(),
});

export type ChecklistProgress = z.infer<typeof checklistProgressSchema>;

export const checklistResponseSchema = z.object({ checklist: checklistSchema });
export const checklistsResponseSchema = z.object({ checklists: z.array(checklistSchema) });
export const checklistItemResponseSchema = z.object({ item: checklistItemSchema });

export const createChecklistSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const updateChecklistSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
});

export const reorderChecklistSchema = z.object({
  position: z.string().min(1),
});

export const createChecklistItemSchema = z.object({
  title: z.string().min(1).max(500).trim(),
});

export const updateChecklistItemSchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  completed: z.boolean().optional(),
});

export const reorderChecklistItemSchema = z.object({
  position: z.string().min(1),
});

export const convertToCardSchema = z.object({
  listId: z.string().min(1),
});

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type ReorderChecklistInput = z.infer<typeof reorderChecklistSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type ReorderChecklistItemInput = z.infer<typeof reorderChecklistItemSchema>;
export type ConvertToCardInput = z.infer<typeof convertToCardSchema>;
