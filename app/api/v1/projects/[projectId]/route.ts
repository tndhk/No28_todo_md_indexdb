import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/markdown';
import { validateProjectId } from '@/lib/security';

interface RouteContext {
    params: Promise<{
        projectId: string;
    }>;
}

/**
 * GET /api/v1/projects/[projectId]
 * Returns a specific project by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const params = await context.params;
        const projectId = params.projectId;

        // Validate project ID
        const projectIdValidation = validateProjectId(projectId);
        if (!projectIdValidation.valid) {
            return NextResponse.json(
                { error: projectIdValidation.error },
                { status: 400 }
            );
        }

        const projects = await getAllProjects();
        const project = projects.find((p) => p.id === projectId);

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(project);
    } catch (error) {
        console.error('Error reading project:', error);
        return NextResponse.json(
            { error: 'Failed to read project' },
            { status: 500 }
        );
    }
}
