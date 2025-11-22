import fs from 'fs';
import path from 'path';
import { getConfig } from './config';
import {
    DANGEROUS_PATTERNS,
    FILE_LOCK_TIMEOUT_MS,
    DEFAULT_MAX_PROJECT_TITLE_LENGTH,
} from './constants';

// File locks to prevent race conditions
const fileLocks = new Map<string, Promise<void>>();

/**
 * Validates that a file path is within the allowed data directory
 * Prevents path traversal attacks
 */
export function validateFilePath(filePath: string): boolean {
    const config = getConfig();
    const normalizedPath = path.normalize(filePath);
    const resolvedPath = path.resolve(filePath);
    const resolvedDataDir = path.resolve(config.dataDir);

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
    const config = getConfig();

    if (!projectId || typeof projectId !== 'string') {
        return { valid: false, error: 'Project ID is required' };
    }

    // Only allow alphanumeric, hyphen, underscore
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(projectId)) {
        return { valid: false, error: 'Project ID contains invalid characters' };
    }

    // Prevent overly long IDs
    if (projectId.length > config.maxProjectIdLength) {
        return { valid: false, error: 'Project ID is too long' };
    }

    return { valid: true };
}

/**
 * Helper: Validates text against dangerous patterns (XSS prevention)
 * @param text - Text to validate
 * @param fieldName - Name of the field (for error messages)
 * @returns Validation result
 *
 * SECURITY: Checks length before regex to prevent ReDoS attacks
 */
function validateAgainstDangerousPatterns(
    text: string,
    fieldName: string
): { valid: boolean; error?: string } {
    // SECURITY: Early return for overly long input to prevent ReDoS
    const MAX_VALIDATION_LENGTH = 10000;
    if (text.length > MAX_VALIDATION_LENGTH) {
        return {
            valid: false,
            error: `${fieldName} is too long for validation (max ${MAX_VALIDATION_LENGTH} characters)`,
        };
    }

    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(text)) {
            return {
                valid: false,
                error: `${fieldName} contains potentially dangerous HTML/JavaScript code`,
            };
        }
    }
    return { valid: true };
}

/**
 * Helper: Validates basic string requirements (type, length)
 * @param text - Text to validate
 * @param fieldName - Name of the field (for error messages)
 * @param maxLength - Maximum allowed length
 * @returns Validation result
 */
function validateBasicStringRequirements(
    text: string,
    fieldName: string,
    maxLength: number
): { valid: boolean; error?: string; trimmed?: string } {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: `${fieldName} is required` };
    }

    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: `${fieldName} cannot be empty` };
    }

    if (trimmed.length > maxLength) {
        return {
            valid: false,
            error: `${fieldName} is too long (max ${maxLength} characters)`,
        };
    }

    return { valid: true, trimmed };
}

/**
 * Validates project title
 */
export function validateProjectTitle(title: string): { valid: boolean; error?: string } {
    // Basic validation
    const basicValidation = validateBasicStringRequirements(
        title,
        'Project title',
        DEFAULT_MAX_PROJECT_TITLE_LENGTH
    );
    if (!basicValidation.valid) {
        return basicValidation;
    }

    // Dangerous pattern validation
    return validateAgainstDangerousPatterns(title, 'Project title');
}

/**
 * Validates task content to prevent XSS and injection
 */
export function validateTaskContent(content: string): { valid: boolean; error?: string } {
    const config = getConfig();

    // Basic validation
    const basicValidation = validateBasicStringRequirements(
        content,
        'Task content',
        config.maxContentLength
    );
    if (!basicValidation.valid) {
        return basicValidation;
    }

    // Dangerous pattern validation
    const dangerousValidation = validateAgainstDangerousPatterns(content, 'Task content');
    if (!dangerousValidation.valid) {
        return dangerousValidation;
    }

    // Prevent multiple #due: tags (could cause parsing issues)
    const dueTags = (content.match(/#due:/g) || []).length;
    if (dueTags > 1) {
        return { valid: false, error: 'Task content cannot contain multiple #due: tags' };
    }

    // Prevent multiple #repeat: tags (could cause parsing issues)
    const repeatTags = (content.match(/#repeat:/g) || []).length;
    if (repeatTags > 1) {
        return { valid: false, error: 'Task content cannot contain multiple #repeat: tags' };
    }

    return { valid: true };
}

/**
 * Validates task status
 */
export function validateTaskStatus(status: string): { valid: boolean; error?: string } {
    const config = getConfig();

    if (!status || typeof status !== 'string') {
        return { valid: false, error: 'Status is required' };
    }

    if (!config.validStatuses.includes(status)) {
        return { valid: false, error: `Invalid status. Must be one of: ${config.validStatuses.join(', ')}` };
    }

    return { valid: true };
}

/**
 * Validates due date format
 */
export function validateDueDate(dueDate?: string): { valid: boolean; error?: string } {
    const config = getConfig();

    if (!dueDate) {
        return { valid: true }; // Due date is optional
    }

    if (typeof dueDate !== 'string') {
        return { valid: false, error: 'Due date must be a string' };
    }

    // Check format YYYY-MM-DD
    if (!config.dueDatePattern.test(dueDate)) {
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
        // Remove any existing #repeat: tags (they'll be added back properly)
        .replace(/#repeat:(daily|weekly|monthly)/g, '')
        .trim();
}

/**
 * Acquires a lock for a file to prevent concurrent modifications
 * Includes timeout to prevent deadlocks
 * @param filePath - Path to the file to lock
 * @returns Function to release the lock
 * @throws {Error} If lock cannot be acquired within timeout period
 */
export async function acquireFileLock(filePath: string): Promise<() => void> {
    const normalizedPath = path.resolve(filePath);
    const startTime = Date.now();

    // Wait for any existing lock with timeout
    while (fileLocks.has(normalizedPath)) {
        if (Date.now() - startTime > FILE_LOCK_TIMEOUT_MS) {
            throw new Error(`Failed to acquire file lock for ${filePath}: timeout after ${FILE_LOCK_TIMEOUT_MS}ms`);
        }
        await fileLocks.get(normalizedPath);
    }

    // Create a new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });

    fileLocks.set(normalizedPath, lockPromise);

    // Auto-release lock after timeout to prevent indefinite locks
    const timeoutId = setTimeout(() => {
        fileLocks.delete(normalizedPath);
        releaseLock!();
    }, FILE_LOCK_TIMEOUT_MS);

    // Return a function to release the lock
    return () => {
        clearTimeout(timeoutId);
        fileLocks.delete(normalizedPath);
        releaseLock!();
    };
}

/**
 * Executes a file operation with proper locking and error handling
 * Ensures lock is always released, even if operation throws
 * @param filePath - Path to the file to lock
 * @param operation - Operation to execute while holding the lock
 * @returns Result of the operation
 * @throws {Error} If lock cannot be acquired or operation fails
 */
export async function withFileLock<T>(
    filePath: string,
    operation: () => T | Promise<T>
): Promise<T> {
    const release = await acquireFileLock(filePath);
    try {
        return await operation();
    } finally {
        // Ensure lock is released in all cases (success or error)
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
