import type { FastifyReply } from 'fastify';
import type { ZodType, ZodTypeDef, ZodError } from 'zod';

/**
 * Validate input against a Zod schema.
 * Sends a 400 response on failure and returns null.
 * On success, returns the parsed and typed data.
 */
export async function validateBody<TOutput, TDef extends ZodTypeDef, TInput>(
  schema: ZodType<TOutput, TDef, TInput>,
  body: unknown,
  reply: FastifyReply,
): Promise<TOutput | null> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    reply.code(400).send({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: (parsed.error as ZodError).flatten().fieldErrors,
    });
    return null;
  }
  return parsed.data;
}
