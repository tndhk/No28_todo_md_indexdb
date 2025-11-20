import { NextRequest, NextResponse } from 'next/server';
import { getAllProjectsFromDir } from '@/lib/markdown';
import { updateTask, deleteTask, handleRecurringTask } from '@/lib/markdown-updater';
import { TaskStatus, RepeatFrequency, Task } from '@/lib/types';
import {
    validateProjectId,
    validateTaskContent,
    validateTaskStatus,
    validateDueDate,
    validateLineNumber,
    validateFilePath,
    withFileLock,
    sanitizeContent,
} from '@/lib/security';
import { auth, getUserDataDir } from '@/lib/auth';

interface RouteContext {
    params: Promise<{
        projectId: string;
        lineNumber: string;
    }>;
}

/**
 * PUT /api/v1/projects/[projectId]/tasks/[lineNumber]
 * Updates a task's properties
 */
export async function PUT(request: NextRequest, context: RouteContext) {
    try {
        const params = await context.params;
        const projectId = params.projectId;
        const lineNumber = parseInt(params.lineNumber, 10);
        const body = await request.json();
        const { content, status, dueDate, repeatFrequency } = body;

        // Validate project ID
        const projectIdValidation = validateProjectId(projectId);
        if (!projectIdValidation.valid) {
            return NextResponse.json(
                { error: projectIdValidation.error },
                { status: 400 }
            );
        }

        // Validate line number
        const lineValidation = validateLineNumber(lineNumber);
        if (!lineValidation.valid) {
            return NextResponse.json(
                { error: lineValidation.error },
                { status: 400 }
            );
        }

        // Get session and user-specific data directory
        const session = await auth();
        const userId = session?.user?.id;
        const dataDir = getUserDataDir(userId);

        // Find project
        const projects = await getAllProjectsFromDir(dataDir);
        const project = projects.find((p) => p.id === projectId);

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        // Validate file path
        if (!validateFilePath(project.path)) {
            return NextResponse.json(
                { error: 'Invalid file path' },
                { status: 400 }
            );
        }

        // Helper to find task by line number
        const findTaskByLineNumber = (tasks: Task[], targetLineNumber: number): Task | undefined => {
            for (const task of tasks) {
                if (task.lineNumber === targetLineNumber) {
                    return task;
                }
                if (task.subtasks.length > 0) {
                    const found = findTaskByLineNumber(task.subtasks, targetLineNumber);
                    if (found) return found;
                }
            }
            return undefined;
        };

        // Find the task
        const task = findTaskByLineNumber(project.tasks, lineNumber);

        // Use file locking
        const result = await withFileLock(project.path, async () => {
            const updates: { content?: string; status?: TaskStatus; dueDate?: string; repeatFrequency?: RepeatFrequency } = {};

            // Validate and prepare updates
            if (content !== undefined) {
                const contentValidation = validateTaskContent(content);
                if (!contentValidation.valid) {
                    return { error: contentValidation.error, status: 400 };
                }
                updates.content = sanitizeContent(content);
            }

            if (status !== undefined) {
                const statusValidation = validateTaskStatus(status);
                if (!statusValidation.valid) {
                    return { error: statusValidation.error, status: 400 };
                }
                updates.status = status as TaskStatus;
            }

            if (dueDate !== undefined) {
                const dueDateValidation = validateDueDate(dueDate);
                if (!dueDateValidation.valid) {
                    return { error: dueDateValidation.error, status: 400 };
                }
                updates.dueDate = dueDate;
            }

            if (repeatFrequency !== undefined) {
                updates.repeatFrequency = repeatFrequency as RepeatFrequency;
            }

            // Check if this is a recurring task being marked as done
            if (status === 'done' && task && task.repeatFrequency) {
                handleRecurringTask(project.path, task);
            } else {
                updateTask(project.path, lineNumber, updates);
            }
            return null;
        });

        // Check for validation errors
        if (result && result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            );
        }

        // Return updated projects
        const updatedProjects = await getAllProjectsFromDir(dataDir);
        return NextResponse.json(updatedProjects);
    } catch (error) {
        console.error('Error updating task:', error);
        // Ensure we always return valid JSON
        const errorMessage = error instanceof Error ? error.message : 'Failed to update task';
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('Error stack:', errorStack);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/v1/projects/[projectId]/tasks/[lineNumber]
 * Deletes a task and its subtasks
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const params = await context.params;
        const projectId = params.projectId;
        const lineNumber = parseInt(params.lineNumber, 10);

        // Validate project ID
        const projectIdValidation = validateProjectId(projectId);
        if (!projectIdValidation.valid) {
            return NextResponse.json(
                { error: projectIdValidation.error },
                { status: 400 }
            );
        }

        // Validate line number
        const lineValidation = validateLineNumber(lineNumber);
        if (!lineValidation.valid) {
            return NextResponse.json(
                { error: lineValidation.error },
                { status: 400 }
            );
        }

        // Get session and user-specific data directory
        const session = await auth();
        const userId = session?.user?.id;
        const dataDir = getUserDataDir(userId);

        // Find project
        const projects = await getAllProjectsFromDir(dataDir);
        const project = projects.find((p) => p.id === projectId);

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        // Validate file path
        if (!validateFilePath(project.path)) {
            return NextResponse.json(
                { error: 'Invalid file path' },
                { status: 400 }
            );
        }

        // Use file locking
        await withFileLock(project.path, async () => {
            deleteTask(project.path, lineNumber);
            return null;
        });

        // Return updated projects
        const updatedProjects = await getAllProjectsFromDir(dataDir);
        return NextResponse.json(updatedProjects);
    } catch (error) {
        console.error('Error deleting task:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete task';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
