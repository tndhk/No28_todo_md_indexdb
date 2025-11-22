import { NextRequest, NextResponse } from 'next/server';
import { getProjectByIdFromDir, getAllProjects } from '@/lib/markdown';
import { addTask } from '@/lib/markdown-updater';
import { TaskStatus, RepeatFrequency, Task } from '@/lib/types';
import { projectCache } from '@/lib/project-cache';
import * as supabaseAdapter from '@/lib/supabase-adapter';
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
        const { content, status, dueDate, parentLineNumber, repeatFrequency } = body;

        // Get session
        const session = await auth();
        const userId = session?.user?.id;

        // Validate inputs first
        const contentValidation = validateTaskContent(content);
        if (!contentValidation.valid) {
            return NextResponse.json(
                { error: contentValidation.error },
                { status: 400 }
            );
        }

        const statusValidation = validateTaskStatus(status);
        if (!statusValidation.valid) {
            return NextResponse.json(
                { error: statusValidation.error },
                { status: 400 }
            );
        }

        const dueDateValidation = validateDueDate(dueDate);
        if (!dueDateValidation.valid) {
            return NextResponse.json(
                { error: dueDateValidation.error },
                { status: 400 }
            );
        }

        if (parentLineNumber !== undefined) {
            const lineValidation = validateLineNumber(parentLineNumber);
            if (!lineValidation.valid) {
                return NextResponse.json(
                    { error: lineValidation.error },
                    { status: 400 }
                );
            }
        }

        // Validate project ID
        const projectIdValidation = validateProjectId(projectId);
        if (!projectIdValidation.valid) {
            return NextResponse.json(
                { error: projectIdValidation.error },
                { status: 400 }
            );
        }

        const sanitizedContent = sanitizeContent(content);

        // Check if Supabase should be used
        const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                                   process.env.SUPABASE_SERVICE_ROLE_KEY;
        const useSupabase = supabaseConfigured && process.env.USE_SUPABASE === 'true';

        if (useSupabase) {
            // Supabase mode
            if (!userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            // Get current project to find parent task if needed
            const currentProject = await supabaseAdapter.getProject(projectId, userId);
            if (!currentProject) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }

            // Find parent task ID if parentLineNumber is provided
            let parentTaskId: string | undefined;
            if (parentLineNumber !== undefined) {
                const findTaskByLineNumber = (tasks: Task[]): Task | undefined => {
                    for (const task of tasks) {
                        if (task.lineNumber === parentLineNumber) return task;
                        if (task.subtasks) {
                            const found = findTaskByLineNumber(task.subtasks);
                            if (found) return found;
                        }
                    }
                    return undefined;
                };
                const parentTask = findTaskByLineNumber(currentProject.tasks);
                if (parentLineNumber !== undefined && !parentTask) {
                    return NextResponse.json(
                        { error: 'Parent task not found' },
                        { status: 404 }
                    );
                }
                parentTaskId = parentTask?.id;
            }

            // Add task via Supabase
            await supabaseAdapter.addTask(
                projectId,
                sanitizedContent,
                status as TaskStatus,
                dueDate,
                parentTaskId,
                repeatFrequency as RepeatFrequency
            );

            // Return updated projects
            const updatedProjects = await getAllProjects();
            apiLogger.info({ requestId, projectId, userId }, `Successfully created task in project ${projectId}`);
            transaction.end(201, { projectId, userId });
            return NextResponse.json(updatedProjects, { status: 201 });
        } else {
            // File-based mode - OPTIMIZED: Read only the specific project
            const dataDir = await getUserDataDir(userId);
            const project = await getProjectByIdFromDir(dataDir, projectId);

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
                addTask(project.path, sanitizedContent, status as TaskStatus, dueDate, parentLineNumber, repeatFrequency as RepeatFrequency);
            });

            // OPTIMIZATION: Invalidate cache after mutation
            projectCache.invalidate(dataDir, projectId);

            // OPTIMIZED: Return only the updated project instead of all projects
            const updatedProject = await getProjectByIdFromDir(dataDir, projectId);
            apiLogger.info({ requestId, projectId, userId }, `Successfully created task in project ${projectId}`);
            transaction.end(201, { projectId, userId });
            return NextResponse.json([updatedProject], { status: 201 });
        }
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
