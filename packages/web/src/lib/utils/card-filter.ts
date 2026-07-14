import type { CardWithProgress } from '@kanbang/shared';
import { getDueDateStatus } from './due-date';

export type DueFilter = 'any' | 'overdue' | 'soon' | 'has' | 'none';

export interface CardFilter {
  query: string;
  labelIds: ReadonlySet<string>;
  due: DueFilter;
}

export function isFilterActive(filter: CardFilter): boolean {
  return filter.query.trim() !== '' || filter.labelIds.size > 0 || filter.due !== 'any';
}

export function cardMatchesFilter(card: CardWithProgress, filter: CardFilter): boolean {
  const query = filter.query.trim().toLowerCase();
  if (query) {
    const haystack = `${card.title}\n${card.description ?? ''}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (filter.labelIds.size > 0 && !card.labelIds.some((id) => filter.labelIds.has(id))) {
    return false;
  }

  if (filter.due !== 'any') {
    const status = getDueDateStatus(card.dueDate, card.completed);
    switch (filter.due) {
      case 'overdue':
        if (status !== 'overdue') return false;
        break;
      case 'soon':
        if (status !== 'soon') return false;
        break;
      case 'has':
        if (!card.dueDate) return false;
        break;
      case 'none':
        if (card.dueDate) return false;
        break;
    }
  }

  return true;
}
