import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { boards } from './boards';

export const lists = sqliteTable(
  'lists',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    position: text('position').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    archivedAt: integer('archived_at', { mode: 'timestamp' }),
  },
  (table) => [index('lists_board_position_idx').on(table.boardId, table.position)],
);
