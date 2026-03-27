export interface Card {
  id: string;
  title: string;
  description: string | null;
  listId: string;
  position: string;
  completed: boolean;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
