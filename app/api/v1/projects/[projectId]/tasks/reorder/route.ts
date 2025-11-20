import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/markdown';
import { rewriteMarkdown } from '@/lib/markdown-updater';
import { Task } from '@/lib/types';
import {
    validateProjectId,
    validateFilePath,
    withFileLock,
} from '@/lib/security';

interface RouteParams {
    params: Promise<{
        projectId: string;
    }>;
}

/**
 * PUT /api/v1/projects/[projectId]/tasks/reorder
 * Reorders tasks within a project
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { projectId } = await params;
        const body = await request.json();
        const { tasks } = body;

        // Validate project ID
        const projectIdValidation = validateProjectId(projectId);
        if (!projectIdValidation.valid) {
            return NextResponse.json(
                { error: projectIdValidation.error },
                { status: 400 }
            );
        }

        // Validate tasks array
        if (!tasks || !Array.isArray(tasks)) {
            return NextResponse.json(
                { error: 'Tasks array required for reordering' },
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
            const updatedProject = { ...project, tasks: tasks as Task[] };
            rewriteMarkdown(project.path, updatedProject);
            return null;
        });

        // Return updated projects
        const updatedProjects = await getAllProjects();
        return NextResponse.json(updatedProjects);
    } catch (error) {
        console.error('Error reordering tasks:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to reorder tasks';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
