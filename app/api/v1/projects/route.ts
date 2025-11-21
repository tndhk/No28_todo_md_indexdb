import { NextResponse } from 'next/server';
import { getAllProjectsFromDir } from '@/lib/markdown';
import { getAllProjects as getAllProjectsFromDB } from '@/lib/supabase-adapter';
import { apiLogger, logError } from '@/lib/logger';
import { startApiTransaction, generateRequestId } from '@/lib/monitoring';
import { auth, getUserDataDir } from '@/lib/auth';
import * as Sentry from '@sentry/nextjs';

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
 */
export async function GET() {
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

        transaction.end(200, { projectCount: projects.length, userId });
        return NextResponse.json(projects);
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
