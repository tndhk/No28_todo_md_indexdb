import { NextRequest, NextResponse } from 'next/server';
import { getAllProjectsFromDir } from '@/lib/markdown';
import { validateProjectId } from '@/lib/security';
import { auth, getUserDataDir } from '@/lib/auth';

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

        // Get session and user-specific data directory
        const session = await auth();
        const userId = session?.user?.id;
        const dataDir = await getUserDataDir(userId);

        const projects = await getAllProjectsFromDir(dataDir);
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
