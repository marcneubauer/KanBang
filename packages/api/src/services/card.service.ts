import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { cards } from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import type { CreateCardInput, UpdateCardInput } from '@kanbang/shared/validation/card.js';

export class CardService {
  constructor(private db: Database) {}

  async create(listId: string, input: CreateCardInput) {
    // Get the last card position to append after it
    const [lastCard] = await this.db
      .select({ position: cards.position })
      .from(cards)
      .where(eq(cards.listId, listId))
      .orderBy(desc(cards.position))
      .limit(1);

    const position = generateKeyBetween(lastCard?.position ?? null, null);
    const now = new Date();

    const [card] = await this.db
      .insert(cards)
      .values({
        id: nanoid(),
        title: input.title,
        description: input.description ?? null,
        listId,
        position,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return card;
  }

  async update(cardId: string, input: UpdateCardInput) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.completed !== undefined) updates.completed = input.completed;

    const [card] = await this.db
      .update(cards)
      .set(updates)
      .where(eq(cards.id, cardId))
      .returning();

    return card ?? null;
  }

  async move(cardId: string, listId: string, position: string) {
    const [card] = await this.db
      .update(cards)
      .set({ listId, position, updatedAt: new Date() })
      .where(eq(cards.id, cardId))
      .returning();

    return card ?? null;
  }

  async delete(cardId: string) {
    const [card] = await this.db
      .delete(cards)
      .where(eq(cards.id, cardId))
      .returning();

    return !!card;
  }

  async getById(cardId: string) {
    const [card] = await this.db
      .select()
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);

    return card ?? null;
  }

  async getListId(cardId: string): Promise<string | null> {
    const card = await this.getById(cardId);
    return card?.listId ?? null;
  }
}
