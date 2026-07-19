import { z } from 'zod';
import { listWithCardsDetailSchema } from './list.js';
import { labelSchema } from './label.js';
import { BACKGROUND_GRADIENT_PRESETS } from '../background-presets.js';

export const createBoardSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const updateBoardSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    cardAgingDays: z.number().int().min(1).max(365).nullable().optional(),
    coversEnabled: z.boolean().optional(),
    backgroundType: z.enum(['color', 'gradient']).nullable().optional(),
    backgroundValue: z.string().max(100).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const typeSet = data.backgroundType !== undefined;
    const valueSet = data.backgroundValue !== undefined;
    if (!typeSet && !valueSet) return;

    if (typeSet !== valueSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'backgroundType and backgroundValue must be provided together',
        path: ['backgroundType'],
      });
      return;
    }

    if (data.backgroundType === null) {
      if (data.backgroundValue !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'backgroundValue must be null when backgroundType is null',
          path: ['backgroundValue'],
        });
      }
    } else if (data.backgroundType === 'color') {
      if (!HEX_COLOR_RE.test(data.backgroundValue ?? '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'backgroundValue must be a hex color like #0079bf',
          path: ['backgroundValue'],
        });
      }
    } else if (data.backgroundType === 'gradient') {
      if (!BACKGROUND_GRADIENT_PRESETS.some((p) => p.id === data.backgroundValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Unknown gradient preset',
          path: ['backgroundValue'],
        });
      }
    }
  });

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

export const boardSchema = z.object({
  id: z.string(),
  name: z.string(),
  userId: z.string(),
  cardAgingDays: z.number().int().nullable(),
  coversEnabled: z.boolean(),
  backgroundType: z.enum(['color', 'gradient']).nullable(),
  backgroundValue: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().nullable(),
});

export type Board = z.infer<typeof boardSchema>;

export const boardsResponseSchema = z.object({ boards: z.array(boardSchema) });
export const boardResponseSchema = z.object({ board: boardSchema });

export const boardDetailSchema = boardSchema.extend({
  lists: z.array(listWithCardsDetailSchema),
  labels: z.array(labelSchema),
});
export type BoardDetail = z.infer<typeof boardDetailSchema>;
export const boardDetailResponseSchema = z.object({ board: boardDetailSchema });
