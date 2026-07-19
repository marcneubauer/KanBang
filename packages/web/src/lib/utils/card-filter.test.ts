import { describe, it, expect } from 'vitest';
import type { CardWithProgress } from '@kanbang/shared';
import { cardMatchesFilter, isFilterActive, type CardFilter } from './card-filter';

function makeCard(overrides: Partial<CardWithProgress> = {}): CardWithProgress {
  return {
    id: 'c1',
    number: null,
    title: 'Fix login bug',
    description: 'Users get a 500 error',
    listId: 'l1',
    position: 'a0',
    completed: false,
    isTemplate: false,
    coverType: null,
    coverValue: null,
    completedAt: null,
    dueDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    checklistProgress: { total: 0, completed: 0 },
    labelIds: [],
    commentCount: 0,
    ...overrides,
  };
}

function makeFilter(overrides: Partial<CardFilter> = {}): CardFilter {
  return { query: '', labelIds: new Set(), due: 'any', ...overrides };
}

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const nextMonth = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

describe('isFilterActive', () => {
  it('is false for the empty filter', () => {
    expect(isFilterActive(makeFilter())).toBe(false);
    expect(isFilterActive(makeFilter({ query: '   ' }))).toBe(false);
  });

  it('is true when any dimension is set', () => {
    expect(isFilterActive(makeFilter({ query: 'x' }))).toBe(true);
    expect(isFilterActive(makeFilter({ labelIds: new Set(['a']) }))).toBe(true);
    expect(isFilterActive(makeFilter({ due: 'overdue' }))).toBe(true);
  });
});

describe('cardMatchesFilter', () => {
  it('matches everything with an empty filter', () => {
    expect(cardMatchesFilter(makeCard(), makeFilter())).toBe(true);
  });

  describe('text query', () => {
    it('matches title case-insensitively', () => {
      expect(cardMatchesFilter(makeCard(), makeFilter({ query: 'LOGIN' }))).toBe(true);
    });

    it('matches description', () => {
      expect(cardMatchesFilter(makeCard(), makeFilter({ query: '500 error' }))).toBe(true);
    });

    it('rejects non-matching text', () => {
      expect(cardMatchesFilter(makeCard(), makeFilter({ query: 'payments' }))).toBe(false);
    });

    it('handles null description', () => {
      const card = makeCard({ description: null });
      expect(cardMatchesFilter(card, makeFilter({ query: 'login' }))).toBe(true);
      expect(cardMatchesFilter(card, makeFilter({ query: '500' }))).toBe(false);
    });
  });

  describe('labels', () => {
    it('matches when the card has any selected label', () => {
      const card = makeCard({ labelIds: ['a', 'b'] });
      expect(cardMatchesFilter(card, makeFilter({ labelIds: new Set(['b', 'z']) }))).toBe(true);
    });

    it('rejects when the card has none of the selected labels', () => {
      const card = makeCard({ labelIds: ['a'] });
      expect(cardMatchesFilter(card, makeFilter({ labelIds: new Set(['z']) }))).toBe(false);
    });
  });

  describe('due date', () => {
    it('overdue matches only overdue cards', () => {
      expect(cardMatchesFilter(makeCard({ dueDate: yesterday() }), makeFilter({ due: 'overdue' }))).toBe(true);
      expect(cardMatchesFilter(makeCard({ dueDate: nextMonth() }), makeFilter({ due: 'overdue' }))).toBe(false);
      expect(cardMatchesFilter(makeCard(), makeFilter({ due: 'overdue' }))).toBe(false);
    });

    it('completed cards are not overdue', () => {
      const card = makeCard({ dueDate: yesterday(), completed: true });
      expect(cardMatchesFilter(card, makeFilter({ due: 'overdue' }))).toBe(false);
    });

    it('soon matches cards due within 24h', () => {
      expect(cardMatchesFilter(makeCard({ dueDate: inOneHour() }), makeFilter({ due: 'soon' }))).toBe(true);
      expect(cardMatchesFilter(makeCard({ dueDate: nextMonth() }), makeFilter({ due: 'soon' }))).toBe(false);
    });

    it('has/none split on presence of a due date', () => {
      expect(cardMatchesFilter(makeCard({ dueDate: nextMonth() }), makeFilter({ due: 'has' }))).toBe(true);
      expect(cardMatchesFilter(makeCard(), makeFilter({ due: 'has' }))).toBe(false);
      expect(cardMatchesFilter(makeCard(), makeFilter({ due: 'none' }))).toBe(true);
      expect(cardMatchesFilter(makeCard({ dueDate: nextMonth() }), makeFilter({ due: 'none' }))).toBe(false);
    });
  });

  it('requires all dimensions to match', () => {
    const card = makeCard({ labelIds: ['a'], dueDate: yesterday() });
    const filter = makeFilter({ query: 'login', labelIds: new Set(['a']), due: 'overdue' });
    expect(cardMatchesFilter(card, filter)).toBe(true);
    expect(cardMatchesFilter(card, { ...filter, query: 'nope' })).toBe(false);
    expect(cardMatchesFilter(card, { ...filter, labelIds: new Set(['z']) })).toBe(false);
    expect(cardMatchesFilter(card, { ...filter, due: 'none' })).toBe(false);
  });
});
