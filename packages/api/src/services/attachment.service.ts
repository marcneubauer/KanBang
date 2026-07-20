import { eq, desc, and } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { attachments, cards } from '../db/schema.js';

interface CreateAttachmentRow {
  id: string;
  userId: string;
  cardId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  storageKey: string;
  thumbKey: string | null;
}

export class AttachmentService {
  constructor(private db: Database) {}

  async listByCard(cardId: string) {
    return this.db
      .select()
      .from(attachments)
      .where(eq(attachments.cardId, cardId))
      .orderBy(desc(attachments.createdAt), desc(attachments.id));
  }

  async get(id: string) {
    const [attachment] = await this.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id))
      .limit(1);
    return attachment ?? null;
  }

  async create(row: CreateAttachmentRow) {
    const [attachment] = await this.db
      .insert(attachments)
      .values({ ...row, createdAt: new Date() })
      .returning();
    return attachment;
  }

  /** Delete the row and clear any card covers pointing at it. Returns the row for file cleanup. */
  async delete(id: string) {
    const [attachment] = await this.db
      .delete(attachments)
      .where(eq(attachments.id, id))
      .returning();

    if (attachment) {
      await this.db
        .update(cards)
        .set({ coverType: null, coverValue: null, updatedAt: new Date() })
        .where(and(eq(cards.coverType, 'attachment'), eq(cards.coverValue, id)));
    }

    return attachment ?? null;
  }

  async allIds(): Promise<Set<string>> {
    const rows = await this.db.select({ id: attachments.id }).from(attachments);
    return new Set(rows.map((r) => r.id));
  }
}
