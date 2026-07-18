import { z } from 'zod';

export const quickAddSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const quickAddConfigSchema = z.object({
  listId: z.string().min(1).nullable(),
});

export type QuickAddInput = z.infer<typeof quickAddSchema>;
export type QuickAddConfigInput = z.infer<typeof quickAddConfigSchema>;
