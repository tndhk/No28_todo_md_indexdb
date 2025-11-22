import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/markdown';
import { updateMarkdown, addTask as addTaskFile, deleteTask as deleteTaskFile, updateTask as updateTaskFile, rewriteMarkdown, handleRecurringTask as handleRecurringTaskFile } from '@/lib/markdown-updater';
import { addTask as addTaskDB, deleteTask as deleteTaskDB, updateTask as updateTaskDB, reorderTasks as reorderTasksDB, handleRecurringTask as handleRecurringTaskDB } from '@/lib/supabase-adapter';
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
import { apiLogger, logError } from '@/lib/logger';
import { startApiTransaction, generateRequestId } from '@/lib/monitoring';
import * as Sentry from '@sentry/nextjs';

// Check if Supabase is configured
const useSupabase = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
    const requestId = generateRequestId();
    const transaction = startApiTransaction({
        method: 'GET',
        path: '/api/projects',
        requestId,
    });

    try {
        const projects = await getAllProjects();
        transaction.end(200, { projectCount: projects.length });
        return NextResponse.json(projects);
    } catch (error) {
        logError(error, { operation: 'GET /api/projects', requestId }, apiLogger);
        Sentry.captureException(error, { extra: { requestId } });
        transaction.end(500);
        return NextResponse.json({ error: 'Failed to read projects' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const requestId = generateRequestId();
    const transaction = startApiTransaction({
        method: 'POST',
        path: '/api/projects',
        requestId,
    });

    try {
        const body = await request.json();
        const { action, projectId, task, content, status, dueDate, parentLineNumber, updates, tasks, repeatFrequency } = body;

        apiLogger.debug({
            requestId,
            action,
            projectId,
        }, `Processing ${action} action for project ${projectId}`);

        // Validate project ID
        const projectIdValidation = validateProjectId(projectId);
        if (!projectIdValidation.valid) {
            apiLogger.warn({ requestId, projectId, error: projectIdValidation.error }, 'Invalid project ID');
            transaction.end(400, { action, error: 'invalid_project_id' });
            return NextResponse.json({ error: projectIdValidation.error }, { status: 400 });
        }

        // Find project path
        const projects = await getAllProjects();
        const project = projects.find((p) => p.id === projectId);

        if (!project) {
            apiLogger.warn({ requestId, projectId }, 'Project not found');
            transaction.end(404, { action, error: 'project_not_found' });
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Validate file path to prevent path traversal (file mode only)
        if (!useSupabase && !validateFilePath(project.path)) {
            apiLogger.warn({ requestId, projectId, path: project.path }, 'Invalid file path - possible path traversal');
            transaction.end(400, { action, error: 'invalid_file_path' });
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }

        // Execute operations (with file locking for file mode, direct for Supabase)
        const executeOperation = async () => {
            switch (action) {
                case 'add': {
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

                    if (useSupabase) {
                        // Supabase mode: use task ID for parent
                        const parentId = task?.parentId; // parentId passed from client
                        await addTaskDB(projectId, sanitizedContent, status as TaskStatus, dueDate, parentId, repeatFrequency as RepeatFrequency);
                    } else {
                        // File mode: use line number for parent
                        addTaskFile(project.path, sanitizedContent, status as TaskStatus, dueDate, parentLineNumber, repeatFrequency as RepeatFrequency);
                    }
                    return null;
                }

                case 'update':
                    if (!useSupabase) {
                        updateMarkdown(project.path, project.tasks);
                    }
                    // Supabase mode: no-op (updates happen per-task)
                    return null;

                case 'updateTask': {
                    if (!task?.id) {
                        return { error: 'Task ID required', status: 400 };
                    }

                    // Validate line number for file mode
                    if (!useSupabase && !task?.lineNumber) {
                        return { error: 'Line number required for file mode', status: 400 };
                    }

                    if (!useSupabase) {
                        const lineValidation = validateLineNumber(task.lineNumber);
                        if (!lineValidation.valid) {
                            return { error: lineValidation.error, status: 400 };
                        }
                    }

                    // Validate updates
                    if (updates) {
                        if (updates.content !== undefined) {
                            const contentValidation = validateTaskContent(updates.content);
                            if (!contentValidation.valid) {
                                return { error: contentValidation.error, status: 400 };
                            }
                            updates.content = sanitizeContent(updates.content);
                        }

                        if (updates.status !== undefined) {
                            const statusValidation = validateTaskStatus(updates.status);
                            if (!statusValidation.valid) {
                                return { error: statusValidation.error, status: 400 };
                            }
                        }

                        if (updates.dueDate !== undefined) {
                            const dueDateValidation = validateDueDate(updates.dueDate);
                            if (!dueDateValidation.valid) {
                                return { error: dueDateValidation.error, status: 400 };
                            }
                        }
                    }

                    // Check if this is a recurring task being marked as done
                    if (updates?.status === 'done' && task.repeatFrequency) {
                        // For recurring tasks, we need the full task object with content
                        // Optimization: Build task map once instead of recursive search - O(n) instead of O(n) per call
                        const taskMap = new Map<string, Task>();
                        const buildTaskMap = (tasks: Task[]) => {
                            tasks.forEach((t) => {
                                taskMap.set(t.id, t);
                                if (t.subtasks?.length > 0) {
                                    buildTaskMap(t.subtasks);
                                }
                            });
                        };
                        buildTaskMap(project.tasks);

                        const fullTask = taskMap.get(task.id);
                        if (fullTask) {
                            // handleRecurringTask handles marking as done and creating next occurrence
                            if (useSupabase) {
                                await handleRecurringTaskDB(fullTask, projectId);
                            } else {
                                handleRecurringTaskFile(project.path, fullTask);
                            }
                        }
                    } else {
                        if (useSupabase) {
                            await updateTaskDB(task.id, updates);
                        } else {
                            updateTaskFile(project.path, task.lineNumber, updates);
                        }
                    }
                    return null;
                }

                case 'delete': {
                    if (!task?.id) {
                        return { error: 'Task ID required', status: 400 };
                    }

                    // Validate line number for file mode
                    if (!useSupabase && !task?.lineNumber) {
                        return { error: 'Line number required for file mode', status: 400 };
                    }

                    if (!useSupabase) {
                        const lineValidation = validateLineNumber(task.lineNumber);
                        if (!lineValidation.valid) {
                            return { error: lineValidation.error, status: 400 };
                        }
                    }

                    if (useSupabase) {
                        await deleteTaskDB(task.id);
                    } else {
                        deleteTaskFile(project.path, task.lineNumber);
                    }
                    return null;
                }

                case 'reorder':
                    if (!tasks || !Array.isArray(tasks)) {
                        return { error: 'Tasks array required for reordering', status: 400 };
                    }

                    if (useSupabase) {
                        await reorderTasksDB(projectId, tasks);
                    } else {
                        // Create a temporary project object with new tasks
                        const updatedProject = { ...project, tasks };
                        rewriteMarkdown(project.path, updatedProject);
                    }
                    return null;

                default:
                    return { error: 'Invalid action', status: 400 };
            }
        };

        // Execute with file locking for file mode, directly for Supabase
        const result = useSupabase
            ? await executeOperation()
            : await withFileLock(project.path, executeOperation);

        // Check for validation errors from within the lock
        if (result && result.error) {
            apiLogger.warn({ requestId, action, projectId, error: result.error }, 'Validation error in action');
            transaction.end(result.status, { action, error: result.error });
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        // Return updated projects
        const updatedProjects = await getAllProjects();
        apiLogger.info({
            requestId,
            action,
            projectId,
        }, `Successfully completed ${action} action for project ${projectId}`);
        transaction.end(200, { action, projectId });
        return NextResponse.json(updatedProjects);
    } catch (error) {
        logError(error, { operation: 'POST /api/projects', requestId, action: 'unknown' }, apiLogger);
        Sentry.captureException(error, { extra: { requestId } });
        transaction.end(500);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update project';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
