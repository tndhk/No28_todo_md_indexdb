import { NextRequest, NextResponse } from 'next/server';
import { getAllProjectsFromDir } from '@/lib/markdown';
import { getAllProjects as getAllProjectsFromDB, createProject as createProjectDB } from '@/lib/supabase-adapter';
import { createProjectFile } from '@/lib/markdown-updater';
import { validateProjectTitle } from '@/lib/security';
import { generateProjectId } from '@/lib/utils';
import { apiLogger, logError } from '@/lib/logger';
import { startApiTransaction, generateRequestId } from '@/lib/monitoring';
import { auth, getUserDataDir } from '@/lib/auth';
import * as Sentry from '@sentry/nextjs';
import path from 'path';
import crypto from 'crypto';

// Check if Supabase is configured
const useSupabase = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.USE_SUPABASE === 'true'
);

/**
 * GET /api/v1/projects
 * Returns all projects with their tasks
 * @optimization Added ETag and Cache-Control headers for better caching
 */
export async function GET(request: NextRequest) {
    const requestId = generateRequestId();
    const transaction = startApiTransaction({
        method: 'GET',
        path: '/api/v1/projects',
        requestId,
    });

    try {
        // Get session and user-specific data directory
        const session = await auth();
        const userId = session?.user?.id;

        // Ensure user is authenticated
        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        apiLogger.debug({ requestId, userId, useSupabase }, 'Fetching projects');

        let projects;
        if (useSupabase) {
            // Use Supabase for project retrieval
            projects = await getAllProjectsFromDB(userId);
        } else {
            // Use file-based storage for local development
            const dataDir = await getUserDataDir(userId);
            projects = await getAllProjectsFromDir(dataDir);
        }

        // OPTIMIZATION: Generate ETag for cache validation
        const responseData = JSON.stringify(projects);
        const etag = `"${crypto.createHash('md5').update(responseData).digest('hex')}"`;

        // Check If-None-Match header
        const ifNoneMatch = request.headers.get('if-none-match');
        if (ifNoneMatch === etag) {
            transaction.end(304, { cached: true, userId });
            return new NextResponse(null, { status: 304 });
        }

        // Set cache headers
        const headers = new Headers({
            'Content-Type': 'application/json',
            'ETag': etag,
            // Cache for 60 seconds, revalidate with server
            'Cache-Control': 'private, max-age=60, must-revalidate',
        });

        transaction.end(200, { projectCount: projects.length, userId });
        return new NextResponse(responseData, { status: 200, headers });
    } catch (error) {
        logError(error, { operation: 'GET /api/v1/projects', requestId }, apiLogger);
        Sentry.captureException(error, { extra: { requestId } });
        transaction.end(500);
        return NextResponse.json(
            { error: 'Failed to read projects' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/v1/projects
 * Creates a new project
 */
export async function POST(request: NextRequest) {
    const requestId = generateRequestId();
    const transaction = startApiTransaction({
        method: 'POST',
        path: '/api/v1/projects',
        requestId,
    });

    try {
        // Get session
        const session = await auth();
        const userId = session?.user?.id;

        // Ensure user is authenticated
        if (!userId) {
            transaction.end(401);
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
            apiLogger.warn({ requestId, userId, error: titleValidation.error }, 'Invalid project title');
            transaction.end(400, { error: 'invalid_title' });
            return NextResponse.json(
                { error: titleValidation.error },
                { status: 400 }
            );
        }

        // Generate unique project ID
        const projectId = generateProjectId(title);

        apiLogger.debug({ requestId, userId, projectId, title, useSupabase }, 'Creating project');

        let project;
        if (useSupabase) {
            // Create project in Supabase
            project = await createProjectDB(userId, projectId, title.trim());
        } else {
            // Create project file
            const dataDir = await getUserDataDir(userId);
            const filePath = path.join(dataDir, `${projectId}.md`);

            // Check if file already exists
            const fs = await import('fs');
            if (fs.existsSync(filePath)) {
                apiLogger.warn({ requestId, userId, projectId, filePath }, 'Project file already exists');
                transaction.end(409, { error: 'project_exists' });
                return NextResponse.json(
                    { error: 'Project already exists' },
                    { status: 409 }
                );
            }

            createProjectFile(filePath, title.trim());

            project = {
                id: projectId,
                title: title.trim(),
                tasks: [],
                path: filePath,
            };
        }

        apiLogger.info({ requestId, userId, projectId, title }, 'Project created successfully');
        transaction.end(201, { projectId });
        return NextResponse.json(project, { status: 201 });
    } catch (error) {
        logError(error, { operation: 'POST /api/v1/projects', requestId }, apiLogger);
        Sentry.captureException(error, { extra: { requestId } });
        transaction.end(500);
        return NextResponse.json(
            { error: 'Failed to create project' },
            { status: 500 }
        );
    }
}
