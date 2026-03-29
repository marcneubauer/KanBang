export interface List {
  id: string;
  name: string;
  boardId: string;
  position: string;
  isDone: boolean;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
