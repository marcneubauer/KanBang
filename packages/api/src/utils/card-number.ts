import { eq, sql } from 'drizzle-orm';
import { boards } from '../db/schema.js';
import type { Database } from '../db/index.js';

/** The transaction handle passed to db.transaction() callbacks. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Reserve `count` sequential board-scoped card numbers; returns the first one.
 * Must run inside the same transaction as the card insert(s) using them.
 */
export function allocateCardNumbers(tx: Tx, boardId: string, count: number): number | null {
  if (count < 1) return null;
  const [board] = tx
    .update(boards)
    .set({ nextCardNumber: sql`${boards.nextCardNumber} + ${count}` })
    .where(eq(boards.id, boardId))
    .returning({ next: boards.nextCardNumber })
    .all();
  return board ? board.next - count : null;
}
