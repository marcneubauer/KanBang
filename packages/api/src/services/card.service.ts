import { eq, and, or, like, desc, asc, isNull, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { cards, lists } from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import type { CreateCardInput, UpdateCardInput } from '@kanbang/shared/validation/card.js';

export class CardService {
  constructor(private db: Database) {}

  async create(listId: string, input: CreateCardInput) {
    // Get the last active card position to append after it
    const [lastCard] = await this.db
      .select({ position: cards.position })
      .from(cards)
      .where(and(eq(cards.listId, listId), isNull(cards.archivedAt)))
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

  async archive(cardId: string) {
    const [card] = await this.db
      .update(cards)
      .set({ archivedAt: new Date() })
      .where(eq(cards.id, cardId))
      .returning();

    return !!card;
  }

  async unarchive(cardId: string) {
    const [card] = await this.db
      .update(cards)
      .set({ archivedAt: null })
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

  async search(boardId: string, options: { q?: string; completed?: boolean }) {
    const conditions = [eq(lists.boardId, boardId), isNull(lists.archivedAt), isNull(cards.archivedAt)];

    if (options.q) {
      const pattern = `%${options.q}%`;
      conditions.push(or(like(cards.title, pattern), like(cards.description, pattern))!);
    }

    if (options.completed !== undefined) {
      conditions.push(eq(cards.completed, options.completed));
    }

    const results = await this.db
      .select({
        id: cards.id,
        title: cards.title,
        description: cards.description,
        listId: cards.listId,
        listName: lists.name,
        position: cards.position,
        completed: cards.completed,
        createdAt: cards.createdAt,
        updatedAt: cards.updatedAt,
      })
      .from(cards)
      .innerJoin(lists, eq(cards.listId, lists.id))
      .where(and(...conditions))
      .orderBy(asc(lists.position), asc(cards.position));

    return results;
  }
}
