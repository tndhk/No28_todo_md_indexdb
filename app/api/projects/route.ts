import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/markdown';
import { updateMarkdown, addTask, deleteTask, updateTask, rewriteMarkdown } from '@/lib/markdown-updater';
import { Task, TaskStatus } from '@/lib/types';
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

export async function GET() {
    try {
        const projects = await getAllProjects();
        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error reading projects:', error);
        return NextResponse.json({ error: 'Failed to read projects' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, projectId, task, content, status, dueDate, parentLineNumber, updates, tasks } = body;

        // Validate project ID
        const projectIdValidation = validateProjectId(projectId);
        if (!projectIdValidation.valid) {
            return NextResponse.json({ error: projectIdValidation.error }, { status: 400 });
        }

        // Find project path
        const projects = await getAllProjects();
        const project = projects.find((p) => p.id === projectId);

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Validate file path to prevent path traversal
        if (!validateFilePath(project.path)) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
        }

        // Use file locking to prevent race conditions
        const result = await withFileLock(project.path, async () => {
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
                    addTask(project.path, sanitizedContent, status as TaskStatus, dueDate, parentLineNumber);
                    return null;
                }

                case 'update':
                    updateMarkdown(project.path, project.tasks);
                    return null;

                case 'updateTask': {
                    if (!task?.lineNumber) {
                        return { error: 'Line number required', status: 400 };
                    }

                    // Validate line number
                    const lineValidation = validateLineNumber(task.lineNumber);
                    if (!lineValidation.valid) {
                        return { error: lineValidation.error, status: 400 };
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

                    updateTask(project.path, task.lineNumber, updates);
                    return null;
                }

                case 'delete': {
                    if (!task?.lineNumber) {
                        return { error: 'Line number required', status: 400 };
                    }

                    // Validate line number
                    const lineValidation = validateLineNumber(task.lineNumber);
                    if (!lineValidation.valid) {
                        return { error: lineValidation.error, status: 400 };
                    }

                    deleteTask(project.path, task.lineNumber);
                    return null;
                }

                case 'reorder':
                    if (!tasks || !Array.isArray(tasks)) {
                        return { error: 'Tasks array required for reordering', status: 400 };
                    }
                    // Create a temporary project object with new tasks
                    const updatedProject = { ...project, tasks };
                    rewriteMarkdown(project.path, updatedProject);
                    return null;

                default:
                    return { error: 'Invalid action', status: 400 };
            }
        });

        // Check for validation errors from within the lock
        if (result && result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        // Return updated projects
        const updatedProjects = await getAllProjects();
        return NextResponse.json(updatedProjects);
    } catch (error) {
        console.error('Error updating project:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update project';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
