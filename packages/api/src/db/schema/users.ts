import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  // No FK: users → lists would create a schema import cycle (lists → boards → users).
  // Validated at write time; resolved defensively at read time.
  quickAddListId: text('quick_add_list_id'),
  theme: text('theme', { enum: ['light', 'dark', 'system'] }).notNull().default('system'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
