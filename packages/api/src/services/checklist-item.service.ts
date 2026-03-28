import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { checklistItems, checklists, cards } from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import type { CreateChecklistItemInput, UpdateChecklistItemInput } from '@kanbang/shared/validation/checklist.js';

export class ChecklistItemService {
  constructor(private db: Database) {}

  async create(checklistId: string, input: CreateChecklistItemInput) {
    const [lastItem] = await this.db
      .select({ position: checklistItems.position })
      .from(checklistItems)
      .where(eq(checklistItems.checklistId, checklistId))
      .orderBy(desc(checklistItems.position))
      .limit(1);

    const position = generateKeyBetween(lastItem?.position ?? null, null);
    const now = new Date();

    const [item] = await this.db
      .insert(checklistItems)
      .values({
        id: nanoid(),
        title: input.title,
        checklistId,
        position,
        completed: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return item;
  }

  async update(itemId: string, input: UpdateChecklistItemInput) {
    const updates: Partial<typeof checklistItems.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) updates.title = input.title;
    if (input.completed !== undefined) updates.completed = input.completed;

    const [item] = await this.db
      .update(checklistItems)
      .set(updates)
      .where(eq(checklistItems.id, itemId))
      .returning();

    return item ?? null;
  }

  async reorder(itemId: string, position: string) {
    const [item] = await this.db
      .update(checklistItems)
      .set({ position, updatedAt: new Date() })
      .where(eq(checklistItems.id, itemId))
      .returning();

    return item ?? null;
  }

  async delete(itemId: string) {
    const [item] = await this.db
      .delete(checklistItems)
      .where(eq(checklistItems.id, itemId))
      .returning();

    return !!item;
  }

  async convertToCard(itemId: string, listId: string) {
    const [item] = await this.db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.id, itemId))
      .limit(1);

    if (!item) return null;

    // Get last card position in the target list
    const [lastCard] = await this.db
      .select({ position: cards.position })
      .from(cards)
      .where(eq(cards.listId, listId))
      .orderBy(desc(cards.position))
      .limit(1);

    const position = generateKeyBetween(lastCard?.position ?? null, null);
    const now = new Date();

    const [newCard] = await this.db
      .insert(cards)
      .values({
        id: nanoid(),
        title: item.title,
        listId,
        position,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Delete the checklist item
    await this.db
      .delete(checklistItems)
      .where(eq(checklistItems.id, itemId));

    return newCard;
  }

  async getChecklistId(itemId: string): Promise<string | null> {
    const [item] = await this.db
      .select({ checklistId: checklistItems.checklistId })
      .from(checklistItems)
      .where(eq(checklistItems.id, itemId))
      .limit(1);

    return item?.checklistId ?? null;
  }
}
