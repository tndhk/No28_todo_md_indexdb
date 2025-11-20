import { NextResponse } from 'next/server';
import { getAllProjectsFromDir } from '@/lib/markdown';
import { apiLogger, logError } from '@/lib/logger';
import { startApiTransaction, generateRequestId } from '@/lib/monitoring';
import { auth, getUserDataDir } from '@/lib/auth';
import * as Sentry from '@sentry/nextjs';

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

        const dataDir = getUserDataDir(userId);

        apiLogger.debug({ requestId, userId, dataDir }, 'Fetching projects');

        const projects = await getAllProjectsFromDir(dataDir);
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
