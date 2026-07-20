import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { cards } from './cards';

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // NULL ⇒ board-background image (referenced by boards.background_value)
    cardId: text('card_id').references(() => cards.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    // Filename inside UPLOADS_DIR ('<id>.<ext>') — never derived from user input
    storageKey: text('storage_key').notNull(),
    thumbKey: text('thumb_key'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('attachments_card_idx').on(table.cardId)],
);
