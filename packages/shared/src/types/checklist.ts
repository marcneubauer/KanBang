export interface Checklist {
  id: string;
  name: string;
  cardId: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  checklistId: string;
  position: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistProgress {
  total: number;
  completed: number;
}
