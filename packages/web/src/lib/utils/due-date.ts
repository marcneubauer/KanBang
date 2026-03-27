export type DueDateStatus = 'none' | 'neutral' | 'soon' | 'overdue' | 'complete';

export function getDueDateStatus(
  dueDate: Date | string | null,
  completed: boolean,
): DueDateStatus {
  if (!dueDate) return 'none';
  if (completed) return 'complete';

  const now = new Date();
  const due = new Date(dueDate);
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilDue < 0) return 'overdue';
  if (hoursUntilDue < 24) return 'soon';
  return 'neutral';
}

export function formatDueDate(dueDate: Date | string): string {
  const due = new Date(dueDate);
  const now = new Date();
  const isThisYear = due.getFullYear() === now.getFullYear();
  return due.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(isThisYear ? {} : { year: 'numeric' }),
  });
}
