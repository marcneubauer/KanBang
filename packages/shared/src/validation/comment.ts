import { z } from 'zod';

export const commentSchema = z.object({
  id: z.string(),
  body: z.string(),
  cardId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Comment = z.infer<typeof commentSchema>;

export const commentResponseSchema = z.object({ comment: commentSchema });
export const commentsResponseSchema = z.object({ comments: z.array(commentSchema) });

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const updateCommentSchema = createCommentSchema;

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
