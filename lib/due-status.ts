export type DueStatus = 'overdue' | 'today' | 'upcoming';

export function getDueStatus(dueDate?: string | null): DueStatus | null {
    if (!dueDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(dueDate);
    if (isNaN(due.getTime())) return null;
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    return 'upcoming';
}

export function formatShortDate(dateString: string): string {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}
