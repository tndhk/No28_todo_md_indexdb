export type TaskStatus = 'todo' | 'doing' | 'done';
export type RepeatFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * Encrypted data structure (from lib/encryption.ts)
 */
export interface EncryptedData {
    ciphertext: string; // Base64 encoded
    iv: string; // Base64 encoded
    salt: string; // Base64 encoded
}

export interface Task {
    id: string;
    content: string;
    status: TaskStatus;
    scheduledDate?: string; // YYYY-MM-DD - When to do the task
    dueDate?: string; // YYYY-MM-DD - Task deadline
    repeatFrequency?: RepeatFrequency; // For recurring tasks
    repeatIntervalDays?: number; // For 'custom' repeat frequency (e.g., 3 for every 3 days)
    subtasks: Task[];
    parentId?: string;
    parentContent?: string; // Parent task content for display
    rawLine: string; // Original line content for updates
    lineNumber: number; // Line number in the file (1-indexed)
    // E2EE: Encrypted content (when encryption is enabled)
    encryptedContent?: EncryptedData;
}

export interface Group {
    id: string;
    name: string;
    tasks: Task[];
    // E2EE: Encrypted group name (when encryption is enabled)
    encryptedName?: EncryptedData;
}

export interface Project {
    id: string; // Filename without extension
    title: string; // H1 content or Filename
    groups: Group[];
    path: string; // Absolute path
    updated_at?: string; // Timestamp for last update, for sync conflict resolution
    // E2EE: Encrypted project title (when encryption is enabled)
    encryptedTitle?: EncryptedData;
    // E2EE: Flag to indicate if this project uses encryption
    isEncrypted?: boolean;
}
