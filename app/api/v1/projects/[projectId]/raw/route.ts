import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateProjectId, validateFilePath, withFileLock } from '@/lib/security';
import { auth, getUserDataDir } from '@/lib/auth';
import { getConfig } from '@/lib/config';

interface RouteContext {
    params: Promise<{
        projectId: string;
    }>;
}

/**
 * GET /api/v1/projects/[projectId]/raw
 * Returns the raw Markdown content of a project
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

        // Read file content
        const config = getConfig();
        const content = fs.readFileSync(filePath, config.fileEncoding);

        return NextResponse.json({ content });
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

        // Get session and user-specific data directory
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

        // Parse request body
        const body = await request.json();
        const { content } = body;

        if (typeof content !== 'string') {
            return NextResponse.json(
                { error: 'Content must be a string' },
                { status: 400 }
            );
        }

        // Use file locking to prevent race conditions
        const config = getConfig();
        await withFileLock(filePath, async () => {
            fs.writeFileSync(filePath, content, config.fileEncoding);
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving raw Markdown:', error);
        return NextResponse.json(
            { error: 'Failed to save project content' },
            { status: 500 }
        );
    }
}
