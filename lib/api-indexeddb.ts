/**
 * IndexedDB-based API client
 * Provides the same interface as lib/api.ts but uses IndexedDB instead of HTTP
 */

import { Task, TaskStatus, Project, RepeatFrequency, Group } from './types';
import * as idb from './indexeddb';
import {
    validateProjectId,
    validateProjectTitle,
    validateTaskContent,
    validateTaskStatus,
    validateDueDate,
} from './validation';
import { MAX_TASK_NESTING_LEVEL } from './constants';

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
 * @security Validates project title and ID to prevent XSS and injection attacks
 */
export async function createProject(title: string): Promise<Project> {
    try {
        // Validate project title
        const titleValidation = validateProjectTitle(title);
        if (!titleValidation.valid) {
            throw new ApiError(titleValidation.error || 'Invalid project title', 400);
        }

        // Generate project ID from title (slugify)
        const id = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'untitled';

        // Validate generated project ID
        const idValidation = validateProjectId(id);
        if (!idValidation.valid) {
            throw new ApiError(idValidation.error || 'Invalid project ID', 400);
        }

        // Check if project already exists
        const existing = await idb.getProjectById(id);
        if (existing) {
            throw new ApiError('A project with this name already exists', 400);
        }

        const defaultGroup: Group = {
            id: `${id}-default-group`,
            name: 'Default',
            tasks: [],
        };

        const newProject: Omit<Project, 'path'> = {
            id,
            title,
            groups: [defaultGroup],
            updated_at: new Date().toISOString(), // Set timestamp for sync
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
 * @security Validates project title to prevent XSS attacks
 */
export async function updateProjectTitle(projectId: string, title: string): Promise<void> {
    try {
        // Validate project title
        const titleValidation = validateProjectTitle(title);
        if (!titleValidation.valid) {
            throw new ApiError(titleValidation.error || 'Invalid project title', 400);
        }

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
 * @security Validates task content, status, and due date to prevent attacks
 */
export async function addTask(
    projectId: string,
    groupId: string,
    content: string,
    status: TaskStatus,
    dueDate?: string,
    parentLineNumber?: number, // Ignored in IndexedDB mode
    repeatFrequency?: RepeatFrequency,
    parentId?: string, // Use this instead of parentLineNumber
    scheduledDate?: string,
    repeatIntervalDays?: number
): Promise<Project[]> {
    try {
        // Validate task content
        const contentValidation = validateTaskContent(content);
        if (!contentValidation.valid) {
            throw new ApiError(contentValidation.error || 'Invalid task content', 400);
        }

        // Validate task status
        const statusValidation = validateTaskStatus(status);
        if (!statusValidation.valid) {
            throw new ApiError(statusValidation.error || 'Invalid task status', 400);
        }

        // Validate due date if provided
        if (dueDate) {
            const dueDateValidation = validateDueDate(dueDate);
            if (!dueDateValidation.valid) {
                throw new ApiError(dueDateValidation.error || 'Invalid due date', 400);
            }
        }

        // Validate scheduled date if provided
        if (scheduledDate) {
            const scheduledDateValidation = validateDueDate(scheduledDate);
            if (!scheduledDateValidation.valid) {
                throw new ApiError(scheduledDateValidation.error || 'Invalid scheduled date', 400);
            }
        }

        await idb.addTask(projectId, groupId, content, status, dueDate, parentId, repeatFrequency, scheduledDate, repeatIntervalDays);
        return await idb.getAllProjects();
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error('Failed to add task:', error);
        throw new ApiError('Failed to add task', 500);
    }
}

/**
 * Update a task's properties
 * Note: lineNumber is used to identify the task in file mode, but in IndexedDB mode we need taskId
 * @security Validates task updates to prevent attacks
 */
export async function updateTask(
    projectId: string,
    lineNumber: number, // This will be ignored, we'll use the task object instead
    updates: {
        content?: string;
        status?: TaskStatus;
        scheduledDate?: string;
        dueDate?: string;
        repeatFrequency?: RepeatFrequency;
        repeatIntervalDays?: number;
    },
    taskId?: string // The actual task ID for IndexedDB mode
): Promise<Project[]> {
    try {
        if (!taskId) {
            throw new ApiError('Task ID is required for IndexedDB mode', 400);
        }

        // Validate content if provided
        if (updates.content !== undefined) {
            const contentValidation = validateTaskContent(updates.content);
            if (!contentValidation.valid) {
                throw new ApiError(contentValidation.error || 'Invalid task content', 400);
            }
        }

        // Validate status if provided
        if (updates.status !== undefined) {
            const statusValidation = validateTaskStatus(updates.status);
            if (!statusValidation.valid) {
                throw new ApiError(statusValidation.error || 'Invalid task status', 400);
            }
        }

        // Validate scheduled date if provided
        if (updates.scheduledDate !== undefined) {
            const scheduledDateValidation = validateDueDate(updates.scheduledDate);
            if (!scheduledDateValidation.valid) {
                throw new ApiError(scheduledDateValidation.error || 'Invalid scheduled date', 400);
            }
        }

        // Validate due date if provided
        if (updates.dueDate !== undefined) {
            const dueDateValidation = validateDueDate(updates.dueDate);
            if (!dueDateValidation.valid) {
                throw new ApiError(dueDateValidation.error || 'Invalid due date', 400);
            }
        }

        // Check if this is a recurring task being marked as done
        const project = await idb.getProjectById(projectId);
        if (!project) {
            throw new ApiError('Project not found', 404);
        }

        // Find the task across all groups
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

        let task: Task | null = null;
        for (const group of project.groups) {
            task = findTaskInTree(group.tasks);
            if (task) break;
        }

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
 * Reorder tasks within a group
 */
export async function reorderTasks(
    projectId: string,
    groupId: string,
    tasks: Task[]
): Promise<Project[]> {
    try {
        await idb.reorderTasks(projectId, groupId, tasks);
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
 * @sync Uses fresh timestamp to prevent old remote data from overwriting local edits
 */
export async function saveRawMarkdown(projectId: string, content: string): Promise<void> {
    try {
        // Parse Markdown and update project
        const parsedProject = parseMarkdownToProject(projectId, content);

        // Always use fresh timestamp for local edits to prevent old remote data
        // from overwriting local changes during sync
        const projectToSave = {
            ...parsedProject,
            updated_at: new Date().toISOString(),
        };



        await idb.updateProject(projectToSave);
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
            const scheduledTag = task.scheduledDate ? ` #do:${task.scheduledDate}` : '';
            const dueTag = task.dueDate ? ` #due:${task.dueDate}` : '';
            let repeatTag = '';
            if (task.repeatFrequency) {
                if (task.repeatFrequency === 'custom' && task.repeatIntervalDays) {
                    repeatTag = ` #repeat:every_${task.repeatIntervalDays}_days`;
                } else {
                    repeatTag = ` #repeat:${task.repeatFrequency}`;
                }
            }
            lines.push(`${indent}- ${checkbox} ${task.content}${scheduledTag}${dueTag}${repeatTag}`);

            if (task.subtasks.length > 0) {
                writeTasks(task.subtasks, indent + '    ');
            }
        });
    }

    // For each group
    project.groups.forEach((group, index) => {
        // Skip group header if it's the only "Default" group
        const isOnlyDefaultGroup = project.groups.length === 1 && group.name === 'Default';

        if (!isOnlyDefaultGroup) {
            lines.push(`### ${group.name}`);
        }

        writeTasks(group.tasks);

        // Add blank line between groups, but not after the last group
        if (index < project.groups.length - 1) {
            lines.push('');
        }
    });

    return lines.join('\n');
}

/**
 * Helper: Parse Markdown to project structure
 * This is a simplified version of lib/markdown.ts parseMarkdown
 */
function parseMarkdownToProject(projectId: string, content: string): Project {
    const lines = content.split('\n');
    let title = projectId;
    const groups: Group[] = [];
    let currentGroup: Group | null = null;
    const taskStack: { task: Task; indent: number }[] = [];
    let hasExplicitGroups = false;

    lines.forEach((line, index) => {
        // Parse Title
        if (line.startsWith('# ')) {
            title = line.substring(2).trim();
            return;
        }

        // Parse Group header (###)
        if (line.startsWith('### ')) {
            hasExplicitGroups = true;
            const groupName = line.substring(4).trim();
            currentGroup = {
                id: `${projectId}-group-${groups.length}`,
                name: groupName,
                tasks: [],
            };
            groups.push(currentGroup);
            taskStack.length = 0; // Reset task stack for new group
            return;
        }

        // Lazy create default group only if we have tasks and no explicit groups
        if (!currentGroup && !hasExplicitGroups) {
            currentGroup = {
                id: `${projectId}-default-group`,
                name: 'Default',
                tasks: [],
            };
            groups.push(currentGroup);
        }

        // Ignore old status section headers (#### Todo, Done, etc.) for backwards compatibility
        // Status is now determined by the checkbox state only
        if (line.startsWith('#### ') || line.startsWith('## ')) {
            return;
        }

        // Parse Tasks
        const taskMatch = line.match(/^(\s*)- \[(x| )\] (.*)/);
        if (taskMatch && currentGroup) {
            const indent = taskMatch[1].length;
            const isChecked = taskMatch[2] === 'x';
            const textContent = taskMatch[3];

            // Extract metadata
            const scheduledMatch = textContent.match(/#do:(\d{4}-\d{2}-\d{2})/);
            const scheduledDate = scheduledMatch ? scheduledMatch[1] : undefined;

            const dueMatch = textContent.match(/#due:(\d{4}-\d{2}-\d{2})/);
            const dueDate = dueMatch ? dueMatch[1] : undefined;

            const repeatMatch = textContent.match(/#repeat:(daily|weekly|monthly|every_\d+_days)/);
            let repeatFrequency: RepeatFrequency | undefined;
            let repeatIntervalDays: number | undefined;
            if (repeatMatch) {
                const matchedFreq = repeatMatch[1];
                if (matchedFreq.startsWith('every_')) {
                    // Parse custom interval (e.g., 'every_3_days' -> 3)
                    const intervalMatch = matchedFreq.match(/every_(\d+)_days/);
                    if (intervalMatch) {
                        repeatFrequency = 'custom';
                        repeatIntervalDays = parseInt(intervalMatch[1], 10);
                    }
                } else {
                    repeatFrequency = matchedFreq as RepeatFrequency;
                }
            }

            const taskContent = textContent
                .replace(/#do:\d{4}-\d{2}-\d{2}/g, '')
                .replace(/#due:\d{4}-\d{2}-\d{2}/g, '')
                .replace(/#repeat:(?:daily|weekly|monthly|every_\d+_days)/g, '')
                .trim();

            // Validate task content to prevent XSS
            const contentValidation = validateTaskContent(taskContent);
            if (!contentValidation.valid) {
                throw new ApiError(`Line ${index + 1}: ${contentValidation.error}`, 400);
            }

            // Handle nesting
            while (taskStack.length > 0 && taskStack[taskStack.length - 1].indent >= indent) {
                taskStack.pop();
            }

            // Prevent deep nesting (DoS protection)
            if (taskStack.length >= MAX_TASK_NESTING_LEVEL) {
                throw new ApiError(`Line ${index + 1}: Maximum nesting level (${MAX_TASK_NESTING_LEVEL}) exceeded`, 400);
            }

            let parentContent: string | undefined;
            if (taskStack.length > 0) {
                parentContent = taskStack[taskStack.length - 1].task.content;
            }

            const newTask: Task = {
                // Use crypto.randomUUID()
                id: `${projectId}-${Date.now()}-${crypto.randomUUID()}`,
                content: taskContent,
                status: isChecked ? 'done' : 'todo',
                scheduledDate,
                dueDate,
                repeatFrequency,
                repeatIntervalDays,
                subtasks: [],
                parentId: taskStack.length > 0 ? taskStack[taskStack.length - 1].task.id : undefined,
                parentContent,
                rawLine: line,
                lineNumber: index + 1,
            };

            if (taskStack.length > 0) {
                taskStack[taskStack.length - 1].task.subtasks.push(newTask);
            } else {
                currentGroup.tasks.push(newTask);
            }

            taskStack.push({ task: newTask, indent });
        }
    });

    // Filter out empty groups (except keep at least one default group if no tasks exist)
    let filteredGroups = groups.filter(group => group.tasks.length > 0);

    // Ensure we have at least one group
    if (filteredGroups.length === 0) {
        filteredGroups = [
            {
                id: `${projectId}-default-group`,
                name: 'Default',
                tasks: [],
            },
        ];
    }

    return {
        id: projectId,
        title,
        groups: filteredGroups,
        path: '',
        updated_at: new Date().toISOString(), // Set timestamp for new/updated projects
    };
}

/**
 * Add a new group to a project
 */
export async function addGroup(projectId: string, name: string): Promise<string> {
    try {
        const groupId = await idb.addGroup(projectId, name);
        return groupId;
    } catch (error) {
        console.error('Failed to add group:', error);
        throw new ApiError('Failed to add group', 500);
    }
}

/**
 * Update a group's name
 */
export async function updateGroup(projectId: string, groupId: string, name: string): Promise<void> {
    try {
        await idb.updateGroup(projectId, groupId, name);
    } catch (error) {
        console.error('Failed to update group:', error);
        throw new ApiError('Failed to update group', 500);
    }
}

/**
 * Delete a group and all its tasks
 */
export async function deleteGroup(projectId: string, groupId: string): Promise<Project[]> {
    try {
        await idb.deleteGroup(projectId, groupId);
        return await idb.getAllProjects();
    } catch (error) {
        console.error('Failed to delete group:', error);
        throw new ApiError('Failed to delete group', 500);
    }
}

/**
 * Move a task to a different parent task within the same group
 */
export async function moveTaskToParent(
    projectId: string,
    groupId: string,
    taskId: string,
    newParentId: string | null
): Promise<Project[]> {
    try {
        await idb.moveTaskToParent(projectId, groupId, taskId, newParentId);
        return await idb.getAllProjects();
    } catch (error) {
        console.error('Failed to move task to parent:', error);
        throw new ApiError('Failed to move task to parent', 500);
    }
}

/**
 * Move a task to a different group
 */
export async function moveTaskToGroup(
    projectId: string,
    fromGroupId: string,
    toGroupId: string,
    taskId: string
): Promise<Project[]> {
    try {
        await idb.moveTaskToGroup(projectId, fromGroupId, toGroupId, taskId);
        return await idb.getAllProjects();
    } catch (error) {
        console.error('Failed to move task to group:', error);
        throw new ApiError('Failed to move task to group', 500);
    }
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
