/**
 * Client-side validation utilities
 * These functions work in both browser and server environments
 * For server-only validations (file path, etc.), see lib/security.ts
 */

import {
    DANGEROUS_PATTERNS,
    DEFAULT_MAX_PROJECT_TITLE_LENGTH,
} from './constants';

/**
 * Client-side safe configuration values
 * These don't require file system access
 */
const CLIENT_CONFIG = {
    validStatuses: ['todo', 'doing', 'done'] as const,
    dueDatePattern: /^\d{4}-\d{2}-\d{2}$/,
    maxContentLength: 500,
    maxProjectIdLength: 100,
};

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
    if (projectId.length > CLIENT_CONFIG.maxProjectIdLength) {
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
    // Basic validation
    const basicValidation = validateBasicStringRequirements(
        content,
        'Task content',
        CLIENT_CONFIG.maxContentLength
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
    if (!status || typeof status !== 'string') {
        return { valid: false, error: 'Status is required' };
    }

    if (!CLIENT_CONFIG.validStatuses.includes(status)) {
        return { valid: false, error: `Invalid status. Must be one of: ${CLIENT_CONFIG.validStatuses.join(', ')}` };
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
    if (!CLIENT_CONFIG.dueDatePattern.test(dueDate)) {
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
