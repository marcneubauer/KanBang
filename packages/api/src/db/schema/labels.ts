import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { boards } from './boards';

export const labels = sqliteTable(
  'labels',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('labels_board_idx').on(table.boardId)],
);
