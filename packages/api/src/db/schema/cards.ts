import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { lists } from './lists';

export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    // Board-scoped auto-incrementing number (like GitHub issues); null only for legacy rows
    number: integer('number'),
    title: text('title').notNull(),
    description: text('description'),
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    position: text('position').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    dueDate: integer('due_date', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    archivedAt: integer('archived_at', { mode: 'timestamp' }),
  },
  (table) => [index('cards_list_position_idx').on(table.listId, table.position)],
);
