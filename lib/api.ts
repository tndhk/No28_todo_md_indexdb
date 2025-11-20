import { Task, TaskStatus, Project } from './types';
import {
    validateProjectsResponse,
    ApiValidationError,
} from './schemas';

/**
 * API client with runtime type validation
 * All API responses are validated against Zod schemas
 */

export class ApiError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}

/**
 * Fetch all projects with validation
 * @throws {ApiError} if the API request fails
 * @throws {ApiValidationError} if response validation fails
 */
export async function fetchProjects(): Promise<Project[]> {
    const res = await fetch('/api/projects');

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to load projects', res.status);
    }

    const data = await res.json();
    return validateProjectsResponse(data);
}

/**
 * Add a new task
 * @throws {ApiError} if the API request fails
 * @throws {ApiValidationError} if response validation fails
 */
export async function addTask(
    projectId: string,
    content: string,
    status: TaskStatus,
    dueDate?: string,
    parentLineNumber?: number
): Promise<Project[]> {
    const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'add',
            projectId,
            content,
            status,
            dueDate,
            parentLineNumber,
        }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to add task', res.status);
    }

    const data = await res.json();
    return validateProjectsResponse(data);
}

/**
 * Update a task's properties
 * @throws {ApiError} if the API request fails
 * @throws {ApiValidationError} if response validation fails
 */
export async function updateTask(
    projectId: string,
    lineNumber: number,
    updates: {
        content?: string;
        status?: TaskStatus;
        dueDate?: string;
    }
): Promise<Project[]> {
    const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'updateTask',
            projectId,
            task: { lineNumber },
            updates,
        }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to update task', res.status);
    }

    const data = await res.json();
    return validateProjectsResponse(data);
}

/**
 * Delete a task
 * @throws {ApiError} if the API request fails
 * @throws {ApiValidationError} if response validation fails
 */
export async function deleteTask(
    projectId: string,
    lineNumber: number
): Promise<Project[]> {
    const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete',
            projectId,
            task: { lineNumber },
        }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to delete task', res.status);
    }

    const data = await res.json();
    return validateProjectsResponse(data);
}

/**
 * Reorder tasks
 * @throws {ApiError} if the API request fails
 * @throws {ApiValidationError} if response validation fails
 */
export async function reorderTasks(
    projectId: string,
    tasks: Task[]
): Promise<Project[]> {
    const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'reorder',
            projectId,
            tasks,
        }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to reorder tasks', res.status);
    }

    const data = await res.json();
    return validateProjectsResponse(data);
}

/**
 * Get a user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof ApiValidationError) {
        // For validation errors, provide a user-friendly message
        // while logging the full details
        console.error('API Validation Error:', error.issues);
        return 'Received unexpected data from server. Please try again.';
    }
    if (error instanceof ApiError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred';
}
