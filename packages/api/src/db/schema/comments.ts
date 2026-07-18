import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { cards } from './cards';

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    body: text('body').notNull(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('comments_card_idx').on(table.cardId)],
);
