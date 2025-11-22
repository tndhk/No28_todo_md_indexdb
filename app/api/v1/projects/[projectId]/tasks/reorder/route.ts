import { NextRequest, NextResponse } from 'next/server';
import { getProjectByIdFromDir, getAllProjects } from '@/lib/markdown';
import { rewriteMarkdown } from '@/lib/markdown-updater';
import { Task } from '@/lib/types';
import { projectCache } from '@/lib/project-cache';
import * as supabaseAdapter from '@/lib/supabase-adapter';
import {
    validateProjectId,
    validateFilePath,
    withFileLock,
} from '@/lib/security';
import { auth, getUserDataDir } from '@/lib/auth';

interface RouteContext {
    params: Promise<{
        projectId: string;
    }>;
}

/**
 * PUT /api/v1/projects/[projectId]/tasks/reorder
 * Reorders tasks within a project
 */
export async function PUT(request: NextRequest, context: RouteContext) {
    try {
        const params = await context.params;
        const projectId = params.projectId;
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

            // Get current project to verify it exists
            const currentProject = await supabaseAdapter.getProject(projectId, userId);
            if (!currentProject) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }

            // Reorder tasks via Supabase
            await supabaseAdapter.reorderTasks(projectId, tasks as Task[]);

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
                const updatedProject = { ...project, tasks: tasks as Task[] };
                rewriteMarkdown(project.path, updatedProject);
            });

            // OPTIMIZATION: Invalidate cache after mutation
            projectCache.invalidate(dataDir, projectId);

            // OPTIMIZED: Return only the updated project instead of all projects
            const updatedProject = await getProjectByIdFromDir(dataDir, projectId);
            return NextResponse.json([updatedProject]);
        }
    } catch (error) {
        console.error('Error reordering tasks:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to reorder tasks';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
