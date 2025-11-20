import { NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/markdown';

/**
 * GET /api/v1/projects
 * Returns all projects with their tasks
 */
export async function GET() {
    try {
        const projects = await getAllProjects();
        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error reading projects:', error);
        return NextResponse.json(
            { error: 'Failed to read projects' },
            { status: 500 }
        );
    }
}
