export interface Board {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
