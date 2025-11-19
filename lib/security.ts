import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// File locks to prevent race conditions
const fileLocks = new Map<string, Promise<void>>();

/**
 * Validates that a file path is within the allowed data directory
 * Prevents path traversal attacks
 */
export function validateFilePath(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const resolvedPath = path.resolve(filePath);
    const resolvedDataDir = path.resolve(DATA_DIR);

    // Check if the path is within the data directory
    if (!resolvedPath.startsWith(resolvedDataDir + path.sep) && resolvedPath !== resolvedDataDir) {
        return false;
    }

    // Check for path traversal patterns
    if (normalizedPath.includes('..')) {
        return false;
    }

    return true;
}

/**
 * Validates project ID to prevent malicious input
 */
export function validateProjectId(projectId: string): { valid: boolean; error?: string } {
    if (!projectId || typeof projectId !== 'string') {
        return { valid: false, error: 'Project ID is required' };
    }

    // Only allow alphanumeric, hyphen, underscore
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(projectId)) {
        return { valid: false, error: 'Project ID contains invalid characters' };
    }

    // Prevent overly long IDs
    if (projectId.length > 100) {
        return { valid: false, error: 'Project ID is too long' };
    }

    return { valid: true };
}

/**
 * Validates task content to prevent XSS and injection
 */
export function validateTaskContent(content: string): { valid: boolean; error?: string } {
    if (!content || typeof content !== 'string') {
        return { valid: false, error: 'Task content is required' };
    }

    // Trim and check length
    const trimmed = content.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'Task content cannot be empty' };
    }

    if (trimmed.length > 500) {
        return { valid: false, error: 'Task content is too long (max 500 characters)' };
    }

    // Prevent multiple #due: tags (could cause parsing issues)
    const dueTags = (content.match(/#due:/g) || []).length;
    if (dueTags > 1) {
        return { valid: false, error: 'Task content cannot contain multiple #due: tags' };
    }

    return { valid: true };
}

/**
 * Validates task status
 */
export function validateTaskStatus(status: string): { valid: boolean; error?: string } {
    const validStatuses = ['todo', 'doing', 'done'];

    if (!status || typeof status !== 'string') {
        return { valid: false, error: 'Status is required' };
    }

    if (!validStatuses.includes(status)) {
        return { valid: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
    }

    return { valid: true };
}

/**
 * Validates due date format
 */
export function validateDueDate(dueDate?: string): { valid: boolean; error?: string } {
    if (!dueDate) {
        return { valid: true }; // Due date is optional
    }

    if (typeof dueDate !== 'string') {
        return { valid: false, error: 'Due date must be a string' };
    }

    // Check format YYYY-MM-DD
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(dueDate)) {
        return { valid: false, error: 'Due date must be in YYYY-MM-DD format' };
    }

    // Validate it's a real date
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) {
        return { valid: false, error: 'Invalid date' };
    }

    return { valid: true };
}

/**
 * Validates line number
 */
export function validateLineNumber(lineNumber: number): { valid: boolean; error?: string } {
    if (lineNumber === undefined || lineNumber === null) {
        return { valid: false, error: 'Line number is required' };
    }

    if (typeof lineNumber !== 'number' || !Number.isInteger(lineNumber)) {
        return { valid: false, error: 'Line number must be an integer' };
    }

    if (lineNumber < 1) {
        return { valid: false, error: 'Line number must be positive' };
    }

    return { valid: true };
}

/**
 * Sanitizes task content by removing potentially harmful patterns
 */
export function sanitizeContent(content: string): string {
    return content
        .trim()
        // Remove any existing #due: tags (they'll be added back properly)
        .replace(/#due:\d{4}-\d{2}-\d{2}/g, '')
        .trim();
}

/**
 * Acquires a lock for a file to prevent concurrent modifications
 */
export async function acquireFileLock(filePath: string): Promise<() => void> {
    const normalizedPath = path.resolve(filePath);

    // Wait for any existing lock
    while (fileLocks.has(normalizedPath)) {
        await fileLocks.get(normalizedPath);
    }

    // Create a new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });

    fileLocks.set(normalizedPath, lockPromise);

    // Return a function to release the lock
    return () => {
        fileLocks.delete(normalizedPath);
        releaseLock!();
    };
}

/**
 * Executes a file operation with proper locking
 */
export async function withFileLock<T>(
    filePath: string,
    operation: () => T | Promise<T>
): Promise<T> {
    const release = await acquireFileLock(filePath);
    try {
        return await operation();
    } finally {
        release();
    }
}

/**
 * Validates that a file exists and is readable
 */
export function validateFileExists(filePath: string): { valid: boolean; error?: string } {
    if (!validateFilePath(filePath)) {
        return { valid: false, error: 'Invalid file path' };
    }

    if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File not found' };
    }

    try {
        fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
        return { valid: false, error: 'File is not accessible' };
    }

    return { valid: true };
}
