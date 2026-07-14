import { z } from 'zod';

export const LABEL_COLORS = [
  '#61bd4f', // green
  '#f2d600', // yellow
  '#ff9f1a', // orange
  '#eb5a46', // red
  '#c377e0', // purple
  '#0079bf', // blue
  '#00c2e0', // sky
  '#51e898', // lime
  '#ff78cb', // pink
  '#344563', // navy
] as const;

export const labelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  boardId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Label = z.infer<typeof labelSchema>;

export const labelResponseSchema = z.object({ label: labelSchema });
export const labelsResponseSchema = z.object({ labels: z.array(labelSchema) });

export const createLabelSchema = z.object({
  name: z.string().max(50).trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #61bd4f'),
});

export const updateLabelSchema = z.object({
  name: z.string().max(50).trim().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #61bd4f').optional(),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
