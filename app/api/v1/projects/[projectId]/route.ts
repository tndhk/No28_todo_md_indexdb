import { NextRequest, NextResponse } from 'next/server';
import { getProjectByIdFromDir } from '@/lib/markdown';
import { getProject, updateProject } from '@/lib/supabase-adapter';
import { validateProjectId, validateProjectTitle } from '@/lib/security';
import { auth, getUserDataDir } from '@/lib/auth';
import { updateProjectTitle } from '@/lib/markdown-updater';
import crypto from 'crypto';

// Check if Supabase is configured
const useSupabase = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.USE_SUPABASE === 'true'
);

interface RouteContext {
    params: Promise<{
        projectId: string;
    }>;
}

/**
 * GET /api/v1/projects/[projectId]
 * Returns a specific project by ID
 * @optimization Added ETag and Cache-Control headers for better caching
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

        // Get session and user ID
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        let project;
        if (useSupabase) {
            // Use Supabase for project retrieval
            project = await getProject(projectId, userId);
        } else {
            // Use file-based storage - OPTIMIZED: Read only the specific project file
            const dataDir = await getUserDataDir(userId);
            project = await getProjectByIdFromDir(dataDir, projectId);
        }

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        // OPTIMIZATION: Generate ETag for cache validation
        const responseData = JSON.stringify(project);
        const etag = `"${crypto.createHash('md5').update(responseData).digest('hex')}"`;

        // Check If-None-Match header
        const ifNoneMatch = request.headers.get('if-none-match');
        if (ifNoneMatch === etag) {
            return new NextResponse(null, { status: 304 });
        }

        // Set cache headers
        const headers = new Headers({
            'Content-Type': 'application/json',
            'ETag': etag,
            'Cache-Control': 'private, max-age=60, must-revalidate',
        });

        return new NextResponse(responseData, { status: 200, headers });
    } catch (error) {
        console.error('Error reading project:', error);
        return NextResponse.json(
            { error: 'Failed to read project' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/v1/projects/[projectId]
 * Updates a project's title
 */
export async function PUT(request: NextRequest, context: RouteContext) {
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

        // Get session and user ID
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { title } = body;

        // Validate title
        const titleValidation = validateProjectTitle(title);
        if (!titleValidation.valid) {
            return NextResponse.json(
                { error: titleValidation.error },
                { status: 400 }
            );
        }

        const trimmedTitle = title.trim();

        if (useSupabase) {
            // Update in Supabase
            await updateProject(userId, projectId, trimmedTitle);
        } else {
            // Update in file-based storage - OPTIMIZED: Read only the specific project
            const dataDir = await getUserDataDir(userId);
            const project = await getProjectByIdFromDir(dataDir, projectId);

            if (!project) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }

            updateProjectTitle(project.path, trimmedTitle);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating project:', error);
        return NextResponse.json(
            { error: 'Failed to update project' },
            { status: 500 }
        );
    }
}
