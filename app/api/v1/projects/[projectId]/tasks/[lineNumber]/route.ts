import { NextRequest, NextResponse } from 'next/server';
import { getProjectByIdFromDir, getAllProjects } from '@/lib/markdown';
import { updateTask, deleteTask, handleRecurringTask } from '@/lib/markdown-updater';
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
import { auth, getUserDataDir } from '@/lib/auth';

interface RouteContext {
    params: Promise<{
        projectId: string;
        lineNumber: string;
    }>;
}

/**
 * Helper to find task by line number
 */
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

        // Get session
        const session = await auth();
        const userId = session?.user?.id;

        // Check if Supabase should be used
        const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                                   process.env.SUPABASE_SERVICE_ROLE_KEY;
        const useSupabase = supabaseConfigured && process.env.USE_SUPABASE === 'true';

        // Validate and prepare updates
        const updates: { content?: string; status?: TaskStatus; dueDate?: string; repeatFrequency?: RepeatFrequency } = {};

        if (content !== undefined) {
            const contentValidation = validateTaskContent(content);
            if (!contentValidation.valid) {
                return NextResponse.json(
                    { error: contentValidation.error },
                    { status: 400 }
                );
            }
            updates.content = sanitizeContent(content);
        }

        if (status !== undefined) {
            const statusValidation = validateTaskStatus(status);
            if (!statusValidation.valid) {
                return NextResponse.json(
                    { error: statusValidation.error },
                    { status: 400 }
                );
            }
            updates.status = status as TaskStatus;
        }

        if (dueDate !== undefined) {
            const dueDateValidation = validateDueDate(dueDate);
            if (!dueDateValidation.valid) {
                return NextResponse.json(
                    { error: dueDateValidation.error },
                    { status: 400 }
                );
            }
            updates.dueDate = dueDate;
        }

        if (repeatFrequency !== undefined) {
            updates.repeatFrequency = repeatFrequency as RepeatFrequency;
        }

        if (useSupabase) {
            // Supabase mode
            if (!userId) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            // Get current project
            const currentProject = await supabaseAdapter.getProject(projectId, userId);
            if (!currentProject) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }

            // Find task by line number
            const task = findTaskByLineNumber(currentProject.tasks, lineNumber);
            if (!task) {
                return NextResponse.json(
                    { error: 'Task not found' },
                    { status: 404 }
                );
            }

            // Update task via Supabase
            await supabaseAdapter.updateTask(task.id, updates);

            // If recurring task being marked as done, add new occurrence
            if (status === 'done' && task.repeatFrequency) {
                await supabaseAdapter.handleRecurringTask(task, projectId);
            }

            // Return updated projects
            const updatedProjects = await getAllProjects();
            return NextResponse.json(updatedProjects);
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

            // Find the task
            const task = findTaskByLineNumber(project.tasks, lineNumber);

            // Use file locking
            await withFileLock(project.path, async () => {
                // Check if this is a recurring task being marked as done
                if (status === 'done' && task && task.repeatFrequency) {
                    handleRecurringTask(project.path, task);
                } else {
                    updateTask(project.path, lineNumber, updates);
                }
            });

            // OPTIMIZATION: Invalidate cache after mutation
            projectCache.invalidate(dataDir, projectId);

            // OPTIMIZED: Return only the updated project instead of all projects
            const updatedProject = await getProjectByIdFromDir(dataDir, projectId);
            return NextResponse.json([updatedProject]);
        }
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

        // Get session
        const session = await auth();
        const userId = session?.user?.id;

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

            // Get current project
            const currentProject = await supabaseAdapter.getProject(projectId, userId);
            if (!currentProject) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }

            // Find task by line number
            const task = findTaskByLineNumber(currentProject.tasks, lineNumber);
            if (!task) {
                return NextResponse.json(
                    { error: 'Task not found' },
                    { status: 404 }
                );
            }

            // Delete task via Supabase
            await supabaseAdapter.deleteTask(task.id);

            // Return updated projects
            const updatedProjects = await getAllProjects();
            return NextResponse.json(updatedProjects);
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
                deleteTask(project.path, lineNumber);
            });

            // OPTIMIZATION: Invalidate cache after mutation
            projectCache.invalidate(dataDir, projectId);

            // OPTIMIZED: Return only the updated project instead of all projects
            const updatedProject = await getProjectByIdFromDir(dataDir, projectId);
            return NextResponse.json([updatedProject]);
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete task';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
