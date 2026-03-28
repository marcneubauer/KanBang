import { eq, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Database } from '../db/index.js';
import { checklists, checklistItems } from '../db/schema.js';
import { generateKeyBetween } from '@kanbang/shared/utils/fractional-index.js';
import type { CreateChecklistInput, UpdateChecklistInput } from '@kanbang/shared/validation/checklist.js';

export class ChecklistService {
  constructor(private db: Database) {}

  async getByCardId(cardId: string) {
    const cardChecklists = await this.db
      .select()
      .from(checklists)
      .where(eq(checklists.cardId, cardId))
      .orderBy(asc(checklists.position));

    const result = await Promise.all(
      cardChecklists.map(async (checklist) => {
        const items = await this.db
          .select()
          .from(checklistItems)
          .where(eq(checklistItems.checklistId, checklist.id))
          .orderBy(asc(checklistItems.position));

        return { ...checklist, items };
      }),
    );

    return result;
  }

  async create(cardId: string, input: CreateChecklistInput) {
    const [lastChecklist] = await this.db
      .select({ position: checklists.position })
      .from(checklists)
      .where(eq(checklists.cardId, cardId))
      .orderBy(desc(checklists.position))
      .limit(1);

    const position = generateKeyBetween(lastChecklist?.position ?? null, null);
    const now = new Date();

    const [checklist] = await this.db
      .insert(checklists)
      .values({
        id: nanoid(),
        name: input.name,
        cardId,
        position,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return { ...checklist, items: [] };
  }

  async update(checklistId: string, input: UpdateChecklistInput) {
    const updates: Partial<typeof checklists.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;

    const [checklist] = await this.db
      .update(checklists)
      .set(updates)
      .where(eq(checklists.id, checklistId))
      .returning();

    return checklist ?? null;
  }

  async reorder(checklistId: string, position: string) {
    const [checklist] = await this.db
      .update(checklists)
      .set({ position, updatedAt: new Date() })
      .where(eq(checklists.id, checklistId))
      .returning();

    return checklist ?? null;
  }

  async delete(checklistId: string) {
    const [checklist] = await this.db
      .delete(checklists)
      .where(eq(checklists.id, checklistId))
      .returning();

    return !!checklist;
  }

  async getCardId(checklistId: string): Promise<string | null> {
    const [checklist] = await this.db
      .select({ cardId: checklists.cardId })
      .from(checklists)
      .where(eq(checklists.id, checklistId))
      .limit(1);

    return checklist?.cardId ?? null;
  }
}
