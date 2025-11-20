import { NextRequest, NextResponse } from 'next/server';
import { getAllProjectsFromDir } from '@/lib/markdown';
import { addTask } from '@/lib/markdown-updater';
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
import { apiLogger, logError } from '@/lib/logger';
import { startApiTransaction, generateRequestId } from '@/lib/monitoring';
import { auth, getUserDataDir } from '@/lib/auth';
import * as Sentry from '@sentry/nextjs';

interface RouteContext {
    params: Promise<{
        projectId: string;
    }>;
}

/**
 * POST /api/v1/projects/[projectId]/tasks
 * Creates a new task in the project
 */
export async function POST(request: NextRequest, context: RouteContext) {
    const requestId = generateRequestId();
    const params = await context.params;
    const projectId = params.projectId;

    const transaction = startApiTransaction({
        method: 'POST',
        path: `/api/v1/projects/${projectId}/tasks`,
        requestId,
    });

    try {
        const body = await request.json();
        const { content, status, dueDate, parentLineNumber } = body;

        // Get session and user-specific data directory
        const session = await auth();
        const userId = session?.user?.id;
        const dataDir = getUserDataDir(userId);

        apiLogger.debug({
            requestId,
            projectId,
            userId,
            status,
            hasParent: !!parentLineNumber,
        }, `Creating new task in project ${projectId}`);

        // Validate project ID
        const projectIdValidation = validateProjectId(projectId);
        if (!projectIdValidation.valid) {
            return NextResponse.json(
                { error: projectIdValidation.error },
                { status: 400 }
            );
        }

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
        const result = await withFileLock(project.path, async () => {
            // Validate content
            const contentValidation = validateTaskContent(content);
            if (!contentValidation.valid) {
                return { error: contentValidation.error, status: 400 };
            }

            // Validate status
            const statusValidation = validateTaskStatus(status);
            if (!statusValidation.valid) {
                return { error: statusValidation.error, status: 400 };
            }

            // Validate due date
            const dueDateValidation = validateDueDate(dueDate);
            if (!dueDateValidation.valid) {
                return { error: dueDateValidation.error, status: 400 };
            }

            // Validate parent line number if provided
            if (parentLineNumber !== undefined) {
                const lineValidation = validateLineNumber(parentLineNumber);
                if (!lineValidation.valid) {
                    return { error: lineValidation.error, status: 400 };
                }
            }

            const sanitizedContent = sanitizeContent(content);
            addTask(project.path, sanitizedContent, status as TaskStatus, dueDate, parentLineNumber);
            return null;
        });

        // Check for validation errors
        if (result && result.error) {
            apiLogger.warn({ requestId, projectId, error: result.error }, 'Validation error creating task');
            transaction.end(result.status, { error: result.error });
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            );
        }

        // Return updated projects
        const updatedProjects = await getAllProjectsFromDir(dataDir);
        apiLogger.info({ requestId, projectId, userId }, `Successfully created task in project ${projectId}`);
        transaction.end(201, { projectId, userId });
        return NextResponse.json(updatedProjects, { status: 201 });
    } catch (error) {
        logError(error, { operation: 'POST /api/v1/projects/tasks', requestId, projectId }, apiLogger);
        Sentry.captureException(error, { extra: { requestId, projectId } });
        transaction.end(500);
        const errorMessage = error instanceof Error ? error.message : 'Failed to add task';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
