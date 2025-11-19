export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
    id: string;
    content: string;
    status: TaskStatus;
    dueDate?: string; // YYYY-MM-DD
    subtasks: Task[];
    parentId?: string;
    parentContent?: string; // Parent task content for display
    rawLine: string; // Original line content for updates
    lineNumber: number; // Line number in the file (1-indexed)
}

export interface Project {
    id: string; // Filename without extension
    title: string; // H1 content or Filename
    tasks: Task[];
    path: string; // Absolute path
}
