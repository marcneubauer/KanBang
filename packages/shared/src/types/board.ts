import type { List } from './list.js';

export interface Board {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface BoardWithLists extends Board {
  lists: List[];
}
