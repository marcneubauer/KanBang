import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const boards = sqliteTable('boards', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  cardAgingDays: integer('card_aging_days'),
  nextCardNumber: integer('next_card_number').notNull().default(1),
  coversEnabled: integer('covers_enabled', { mode: 'boolean' }).notNull().default(true),
  isTemplate: integer('is_template', { mode: 'boolean' }).notNull().default(false),
  backgroundType: text('background_type', { enum: ['color', 'gradient', 'image'] }),
  backgroundValue: text('background_value'),
  // Derived accent for image backgrounds (dominant color at upload); null otherwise
  backgroundAccent: text('background_accent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
});
