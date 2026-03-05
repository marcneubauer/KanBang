export interface Card {
  id: string;
  title: string;
  description: string | null;
  listId: string;
  position: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
