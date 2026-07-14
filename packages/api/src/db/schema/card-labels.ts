import { sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
import { cards } from './cards';
import { labels } from './labels';

export const cardLabels = sqliteTable(
  'card_labels',
  {
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.cardId, table.labelId] }),
    index('card_labels_label_idx').on(table.labelId),
  ],
);
