/**
 * IndexedDB-based API client
 * Provides the same interface as lib/api.ts but uses IndexedDB instead of HTTP
 */

import { Task, TaskStatus, Project, RepeatFrequency } from './types';
import * as idb from './indexeddb';

export class ApiError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}

/**
 * Fetch all projects
 */
export async function fetchProjects(): Promise<Project[]> {
    try {
        const projects = await idb.getAllProjects();

        // Initialize sample data if database is empty
        if (projects.length === 0) {
            await idb.initializeSampleData();
            return await idb.getAllProjects();
        }

        return projects;
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        throw new ApiError('Failed to load projects from IndexedDB', 500);
    }
}

/**
 * Create a new project
 */
export async function createProject(title: string): Promise<Project> {
    try {
        // Generate project ID from title (slugify)
        const id = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'untitled';

        // Check if project already exists
        const existing = await idb.getProjectById(id);
        if (existing) {
            throw new ApiError('A project with this name already exists', 400);
        }

        const newProject: Omit<Project, 'path'> = {
            id,
            title,
            tasks: [],
        };

        await idb.addProject(newProject);

        // Return the created project with path
        return { ...newProject, path: '' };
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error('Failed to create project:', error);
        throw new ApiError('Failed to create project', 500);
    }
}

/**
 * Update a project's title
 */
export async function updateProjectTitle(projectId: string, title: string): Promise<void> {
    try {
        const project = await idb.getProjectById(projectId);
        if (!project) {
            throw new ApiError('Project not found', 404);
        }

        await idb.updateProject({ id: projectId, title });
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error('Failed to update project title:', error);
        throw new ApiError('Failed to update project title', 500);
    }
}

/**
 * Add a new task
 * Note: lineNumber is ignored in IndexedDB mode, parentId should be used instead
 */
export async function addTask(
    projectId: string,
    content: string,
    status: TaskStatus,
    dueDate?: string,
    parentLineNumber?: number, // Ignored in IndexedDB mode
    repeatFrequency?: RepeatFrequency,
    parentId?: string // Use this instead of parentLineNumber
): Promise<Project[]> {
    try {
        await idb.addTask(projectId, content, status, dueDate, parentId, repeatFrequency);
        return await idb.getAllProjects();
    } catch (error) {
        console.error('Failed to add task:', error);
        throw new ApiError('Failed to add task', 500);
    }
}

/**
 * Update a task's properties
 * Note: lineNumber is used to identify the task in file mode, but in IndexedDB mode we need taskId
 */
export async function updateTask(
    projectId: string,
    lineNumber: number, // This will be ignored, we'll use the task object instead
    updates: {
        content?: string;
        status?: TaskStatus;
        dueDate?: string;
        repeatFrequency?: RepeatFrequency;
    },
    taskId?: string // The actual task ID for IndexedDB mode
): Promise<Project[]> {
    try {
        if (!taskId) {
            throw new ApiError('Task ID is required for IndexedDB mode', 400);
        }

        // Check if this is a recurring task being marked as done
        const project = await idb.getProjectById(projectId);
        if (!project) {
            throw new ApiError('Project not found', 404);
        }

        // Find the task
        const findTaskInTree = (tasks: Task[]): Task | null => {
            for (const task of tasks) {
                if (task.id === taskId) return task;
                if (task.subtasks.length > 0) {
                    const found = findTaskInTree(task.subtasks);
                    if (found) return found;
                }
            }
            return null;
        };

        const task = findTaskInTree(project.tasks);
        if (!task) {
            throw new ApiError('Task not found', 404);
        }

        // Handle recurring tasks
        if (updates.status === 'done' && task.repeatFrequency) {
            await idb.handleRecurringTask(projectId, taskId);
        } else {
            await idb.updateTask(projectId, taskId, updates);
        }

        return await idb.getAllProjects();
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error('Failed to update task:', error);
        throw new ApiError('Failed to update task', 500);
    }
}

/**
 * Delete a task
 */
export async function deleteTask(
    projectId: string,
    lineNumber: number, // Ignored in IndexedDB mode
    taskId?: string // The actual task ID for IndexedDB mode
): Promise<Project[]> {
    try {
        if (!taskId) {
            throw new ApiError('Task ID is required for IndexedDB mode', 400);
        }

        await idb.deleteTask(projectId, taskId);
        return await idb.getAllProjects();
    } catch (error) {
        console.error('Failed to delete task:', error);
        throw new ApiError('Failed to delete task', 500);
    }
}

/**
 * Reorder tasks
 */
export async function reorderTasks(
    projectId: string,
    tasks: Task[]
): Promise<Project[]> {
    try {
        await idb.reorderTasks(projectId, tasks);
        return await idb.getAllProjects();
    } catch (error) {
        console.error('Failed to reorder tasks:', error);
        throw new ApiError('Failed to reorder tasks', 500);
    }
}

/**
 * Fetch raw Markdown content for a project
 * Note: In IndexedDB mode, we need to serialize the project to Markdown
 */
export async function fetchRawMarkdown(projectId: string): Promise<string> {
    try {
        const project = await idb.getProjectById(projectId);
        if (!project) {
            throw new ApiError('Project not found', 404);
        }

        // Serialize project to Markdown format
        return serializeProjectToMarkdown(project);
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error('Failed to fetch raw markdown:', error);
        throw new ApiError('Failed to load project content', 500);
    }
}

/**
 * Save raw Markdown content for a project
 * Note: In IndexedDB mode, we need to parse Markdown and update the project
 */
export async function saveRawMarkdown(projectId: string, content: string): Promise<void> {
    try {
        // Parse Markdown and update project
        const project = parseMarkdownToProject(projectId, content);
        await idb.updateProject(project);
    } catch (error) {
        console.error('Failed to save raw markdown:', error);
        throw new ApiError('Failed to save project content', 500);
    }
}

/**
 * Helper: Serialize project to Markdown format
 */
function serializeProjectToMarkdown(project: Project): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${project.title}`);
    lines.push('');

    // Helper to write tasks recursively
    function writeTasks(tasks: Task[], indent: string = '') {
        tasks.forEach(task => {
            const checkbox = task.status === 'done' ? '[x]' : '[ ]';
            const dueTag = task.dueDate ? ` #due:${task.dueDate}` : '';
            const repeatTag = task.repeatFrequency ? ` #repeat:${task.repeatFrequency}` : '';
            lines.push(`${indent}- ${checkbox} ${task.content}${dueTag}${repeatTag}`);

            if (task.subtasks.length > 0) {
                writeTasks(task.subtasks, indent + '    ');
            }
        });
    }

    // Group tasks by status
    const todoTasks = project.tasks.filter(t => t.status === 'todo');
    const doingTasks = project.tasks.filter(t => t.status === 'doing');
    const doneTasks = project.tasks.filter(t => t.status === 'done');

    if (todoTasks.length > 0) {
        lines.push('## Todo');
        writeTasks(todoTasks);
        lines.push('');
    }

    if (doingTasks.length > 0) {
        lines.push('## Doing');
        writeTasks(doingTasks);
        lines.push('');
    }

    if (doneTasks.length > 0) {
        lines.push('## Done');
        writeTasks(doneTasks);
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Helper: Parse Markdown to project structure
 * This is a simplified version of lib/markdown.ts parseMarkdown
 */
function parseMarkdownToProject(projectId: string, content: string): Project {
    const lines = content.split('\n');
    let title = projectId;
    const tasks: Task[] = [];
    let currentSection: TaskStatus = 'todo';
    const taskStack: { task: Task; indent: number }[] = [];

    lines.forEach((line, index) => {
        // Parse Title
        if (line.startsWith('# ')) {
            title = line.substring(2).trim();
            return;
        }

        // Parse Sections
        if (line.startsWith('## ')) {
            const sectionName = line.substring(3).trim().toLowerCase();
            if (sectionName.includes('todo')) currentSection = 'todo';
            else if (sectionName.includes('doing')) currentSection = 'doing';
            else if (sectionName.includes('done')) currentSection = 'done';
            return;
        }

        // Parse Tasks
        const taskMatch = line.match(/^(\s*)- \[(x| )\] (.*)/);
        if (taskMatch) {
            const indent = taskMatch[1].length;
            const isChecked = taskMatch[2] === 'x';
            const textContent = taskMatch[3];

            // Extract metadata
            const dueMatch = textContent.match(/#due:(\d{4}-\d{2}-\d{2})/);
            const dueDate = dueMatch ? dueMatch[1] : undefined;

            const repeatMatch = textContent.match(/#repeat:(daily|weekly|monthly)/);
            const repeatFrequency = repeatMatch ? (repeatMatch[1] as RepeatFrequency) : undefined;

            const content = textContent
                .replace(/#due:\d{4}-\d{2}-\d{2}/g, '')
                .replace(/#repeat:(?:daily|weekly|monthly)/g, '')
                .trim();

            // Handle nesting
            while (taskStack.length > 0 && taskStack[taskStack.length - 1].indent >= indent) {
                taskStack.pop();
            }

            let parentContent: string | undefined;
            if (taskStack.length > 0) {
                parentContent = taskStack[taskStack.length - 1].task.content;
            }

            const newTask: Task = {
                id: `${projectId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                content,
                status: isChecked ? 'done' : currentSection,
                dueDate,
                repeatFrequency,
                subtasks: [],
                parentId: taskStack.length > 0 ? taskStack[taskStack.length - 1].task.id : undefined,
                parentContent,
                rawLine: line,
                lineNumber: index + 1,
            };

            if (taskStack.length > 0) {
                taskStack[taskStack.length - 1].task.subtasks.push(newTask);
            } else {
                tasks.push(newTask);
            }

            taskStack.push({ task: newTask, indent });
        }
    });

    return {
        id: projectId,
        title,
        tasks,
        path: '',
    };
}

/**
 * Get a user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred';
}
