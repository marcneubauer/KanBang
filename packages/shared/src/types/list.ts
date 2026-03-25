export interface List {
  id: string;
  name: string;
  boardId: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
