export type TaskStatus = 'todo' | 'doing' | 'done';
export type RepeatFrequency = 'daily' | 'weekly' | 'monthly';

export interface Task {
    id: string;
    content: string;
    status: TaskStatus;
    dueDate?: string; // YYYY-MM-DD
    repeatFrequency?: RepeatFrequency; // For recurring tasks
    subtasks: Task[];
    parentId?: string;
    parentContent?: string; // Parent task content for display
    rawLine: string; // Original line content for updates
    lineNumber: number; // Line number in the file (1-indexed)
}

export interface Group {
    id: string;
    name: string;
    tasks: Task[];
}

export interface Project {
    id: string; // Filename without extension
    title: string; // H1 content or Filename
    groups: Group[];
    path: string; // Absolute path
}
