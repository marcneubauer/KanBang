import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { cards } from './cards';

export const checklists = sqliteTable(
  'checklists',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    position: text('position').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('checklists_card_position_idx').on(table.cardId, table.position)],
);
