import { Task, TaskStatus, Project, RepeatFrequency } from './types';
import {
    validateProjectsResponse,
    ApiValidationError,
} from './schemas';

/**
 * API client with runtime type validation
 * All API responses are validated against Zod schemas
 * SECURITY: Includes CSRF protection for state-changing requests
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
 * CSRF token management
 * SECURITY: Protects against Cross-Site Request Forgery attacks
 */
let csrfToken: string | null = null;
let csrfHeaderName: string | null = null;

async function getCsrfToken(): Promise<{ token: string; headerName: string }> {
    if (csrfToken && csrfHeaderName) {
        return { token: csrfToken, headerName: csrfHeaderName };
    }

    try {
        const res = await fetch('/api/csrf');
        if (res.ok) {
            const data = await res.json();
            if (data.csrfToken && data.headerName) {
                csrfToken = data.csrfToken;
                csrfHeaderName = data.headerName;
                return { token: data.csrfToken, headerName: data.headerName };
            }
        }
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
    }

    // Fallback if CSRF endpoint fails
    return { token: '', headerName: 'x-csrf-token' };
}

/**
 * Helper: Add CSRF token to request headers
 */
async function addCsrfHeader(headers: HeadersInit = {}): Promise<HeadersInit> {
    const { token, headerName } = await getCsrfToken();
    return {
        ...headers,
        [headerName]: token,
    };
}

/**
 * Fetch all projects with validation
 * @throws {ApiError} if the API request fails
 * @throws {ApiValidationError} if response validation fails
 */
export async function fetchProjects(): Promise<Project[]> {
    const res = await fetch('/api/v1/projects');

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to load projects', res.status);
    }

    const data = await res.json();
    return validateProjectsResponse(data);
}

/**
 * Create a new project
 * @throws {ApiError} if the API request fails
 */
export async function createProject(title: string): Promise<Project> {
    const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: await addCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to create project', res.status);
    }

    const data = await res.json();
    return data;
}

/**
 * Update a project's title
 * @throws {ApiError} if the API request fails
 */
export async function updateProjectTitle(projectId: string, title: string): Promise<void> {
    const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
        method: 'PUT',
        headers: await addCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to update project title', res.status);
    }
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
    parentLineNumber?: number,
    repeatFrequency?: RepeatFrequency
): Promise<Project[]> {
    const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks`, {
        method: 'POST',
        headers: await addCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
            content,
            status,
            dueDate,
            parentLineNumber,
            repeatFrequency,
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
        repeatFrequency?: RepeatFrequency;
    }
): Promise<Project[]> {
    const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks/${lineNumber}`, {
        method: 'PUT',
        headers: await addCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updates),
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
    const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks/${lineNumber}`, {
        method: 'DELETE',
        headers: await addCsrfHeader({}),
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
    const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/tasks/reorder`, {
        method: 'PUT',
        headers: await addCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ tasks }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to reorder tasks', res.status);
    }

    const data = await res.json();
    return validateProjectsResponse(data);
}

/**
 * Fetch raw Markdown content for a project
 * @throws {ApiError} if the API request fails
 */
export async function fetchRawMarkdown(projectId: string): Promise<string> {
    const url = `/api/v1/projects/${encodeURIComponent(projectId)}/raw`;
    console.log('[fetchRawMarkdown] URL:', url, 'projectId:', projectId);

    const res = await fetch(url);
    console.log('[fetchRawMarkdown] Response status:', res.status, 'ok:', res.ok);

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[fetchRawMarkdown] Error response:', errorData);
        throw new ApiError(errorData.error || 'Failed to load project content', res.status);
    }

    const data = await res.json();
    console.log('[fetchRawMarkdown] Response data:', data);
    console.log('[fetchRawMarkdown] Content type:', typeof data.content, 'length:', data.content?.length);
    return data.content || '';
}

/**
 * Save raw Markdown content for a project
 * @throws {ApiError} if the API request fails
 */
export async function saveRawMarkdown(projectId: string, content: string): Promise<void> {
    const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/raw`, {
        method: 'PUT',
        headers: await addCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content }),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || 'Failed to save project content', res.status);
    }
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
