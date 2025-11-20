import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/markdown';
import { updateTask, deleteTask } from '@/lib/markdown-updater';
import { TaskStatus } from '@/lib/types';
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

interface RouteParams {
    params: Promise<{
        projectId: string;
        lineNumber: string;
    }>;
}

/**
 * PUT /api/v1/projects/[projectId]/tasks/[lineNumber]
 * Updates a task's properties
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { projectId, lineNumber: lineNumberStr } = await params;
        const lineNumber = parseInt(lineNumberStr, 10);
        const body = await request.json();
        const { content, status, dueDate } = body;

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

        // Find project
        const projects = await getAllProjects();
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
        const result = await withFileLock(project.path, async () => {
            const updates: { content?: string; status?: TaskStatus; dueDate?: string } = {};

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

            updateTask(project.path, lineNumber, updates);
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
        const updatedProjects = await getAllProjects();
        return NextResponse.json(updatedProjects);
    } catch (error) {
        console.error('Error updating task:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update task';
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
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { projectId, lineNumber: lineNumberStr } = await params;
        const lineNumber = parseInt(lineNumberStr, 10);

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

        // Find project
        const projects = await getAllProjects();
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
        const updatedProjects = await getAllProjects();
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
