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
  isTemplate: z.boolean(),
  coverType: z.enum(['color', 'image']).nullable(),
  coverValue: z.string().nullable(),
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

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const HTTP_URL_RE = /^https?:\/\/.+/;

export const updateCardSchema = z
  .object({
    title: z.string().min(1).max(500).trim().optional(),
    description: z.string().max(5000).nullable().optional(),
    completed: z.boolean().optional(),
    isTemplate: z.boolean().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    coverType: z.enum(['color', 'image']).nullable().optional(),
    coverValue: z.string().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const typeSet = data.coverType !== undefined;
    const valueSet = data.coverValue !== undefined;
    if (!typeSet && !valueSet) return;

    if (typeSet !== valueSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'coverType and coverValue must be provided together',
        path: ['coverType'],
      });
      return;
    }

    if (data.coverType === null) {
      if (data.coverValue !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'coverValue must be null when coverType is null',
          path: ['coverValue'],
        });
      }
    } else if (data.coverType === 'color') {
      if (!HEX_COLOR_RE.test(data.coverValue ?? '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'coverValue must be a hex color like #0079bf',
          path: ['coverValue'],
        });
      }
    } else if (data.coverType === 'image') {
      if (!HTTP_URL_RE.test(data.coverValue ?? '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'coverValue must be an http(s) image URL',
          path: ['coverValue'],
        });
      }
    }
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
