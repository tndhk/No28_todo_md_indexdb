import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateProjectId, validateFilePath, withFileLock } from '@/lib/security';
import { auth, getUserDataDir } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { renderMarkdown } from '@/lib/markdown-renderer';
import { parseMarkdown } from '@/lib/markdown';
import { getProject, batchAddTasks, deleteAllTasksForProject } from '@/lib/supabase-adapter';

interface RouteContext {
    params: Promise<{
        projectId: string;
    }>;
}

/**
 * GET /api/v1/projects/[projectId]/raw
 * Returns the raw Markdown content of a project
 * Uses Supabase if configured, falls back to file-based storage
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

        // Check if Supabase should be used
        const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                                   process.env.SUPABASE_SERVICE_ROLE_KEY;
        const useSupabase = supabaseConfigured && process.env.USE_SUPABASE === 'true';

        if (useSupabase) {
            // Supabase mode: Fetch from DB and render as Markdown
            const session = await auth();
            const userId = session?.user?.id;

            if (!userId) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }

            const project = await getProject(projectId, userId);

            if (!project) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }

            // Render project data as Markdown
            const content = renderMarkdown(project);

            return NextResponse.json({ content });
        } else {
            // File-based mode: Read from filesystem
            const session = await auth();
            const userId = session?.user?.id;
            const dataDir = await getUserDataDir(userId);

            // Build file path
            const filePath = path.join(dataDir, `${projectId}.md`);

            // Validate file path to prevent path traversal
            if (!validateFilePath(filePath)) {
                return NextResponse.json(
                    { error: 'Invalid file path' },
                    { status: 400 }
                );
            }

            if (!fs.existsSync(filePath)) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }

            // Read file content
            const config = getConfig();
            const content = fs.readFileSync(filePath, config.fileEncoding);

            return NextResponse.json({ content });
        }
    } catch (error) {
        console.error('Error reading raw Markdown:', error);
        return NextResponse.json(
            { error: 'Failed to read project content' },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/v1/projects/[projectId]/raw
 * Saves the raw Markdown content of a project
 * Uses Supabase if configured, falls back to file-based storage
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

        // Parse request body
        const body = await request.json();
        const { content } = body;

        if (typeof content !== 'string') {
            return NextResponse.json(
                { error: 'Content must be a string' },
                { status: 400 }
            );
        }

        // Check if Supabase should be used
        const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL &&
                                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
                                   process.env.SUPABASE_SERVICE_ROLE_KEY;
        const useSupabase = supabaseConfigured && process.env.USE_SUPABASE === 'true';

        if (useSupabase) {
            // Supabase mode: Parse Markdown and update DB
            const session = await auth();
            const userId = session?.user?.id;

            if (!userId) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }

            // Verify project exists and user has access
            const project = await getProject(projectId, userId);
            if (!project) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }

            // Parse the Markdown content
            const parsedProject = parseMarkdown(projectId, content, '');

            // Delete all existing tasks for this project
            await deleteAllTasksForProject(projectId);

            // OPTIMIZATION: Use batch insert instead of N individual inserts
            // This eliminates N+1 queries by using a single batch operation
            await batchAddTasks(projectId, parsedProject.tasks);

            return NextResponse.json({ success: true });
        } else {
            // File-based mode: Save to filesystem
            const session = await auth();
            const userId = session?.user?.id;
            const dataDir = await getUserDataDir(userId);

            // Build file path
            const filePath = path.join(dataDir, `${projectId}.md`);

            // Validate file path to prevent path traversal
            if (!validateFilePath(filePath)) {
                return NextResponse.json(
                    { error: 'Invalid file path' },
                    { status: 400 }
                );
            }

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return NextResponse.json(
                    { error: 'Project not found' },
                    { status: 404 }
                );
            }

            // Use file locking to prevent race conditions
            const config = getConfig();
            await withFileLock(filePath, async () => {
                fs.writeFileSync(filePath, content, config.fileEncoding);
            });

            return NextResponse.json({ success: true });
        }
    } catch (error) {
        console.error('Error saving raw Markdown:', error);
        return NextResponse.json(
            { error: 'Failed to save project content' },
            { status: 500 }
        );
    }
}
