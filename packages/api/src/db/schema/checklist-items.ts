import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { checklists } from './checklists';

export const checklistItems = sqliteTable(
  'checklist_items',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    checklistId: text('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    position: text('position').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('checklist_items_checklist_position_idx').on(table.checklistId, table.position)],
);
