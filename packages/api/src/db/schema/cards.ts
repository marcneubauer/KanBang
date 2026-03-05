import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { lists } from './lists';

export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    position: text('position').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('cards_list_position_idx').on(table.listId, table.position)],
);
