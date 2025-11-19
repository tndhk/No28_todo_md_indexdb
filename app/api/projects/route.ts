import { NextRequest, NextResponse } from 'next/server';
import { getAllProjects } from '@/lib/markdown';
import { updateMarkdown, addTask, deleteTask, updateTask } from '@/lib/markdown-updater';
import { Task, TaskStatus } from '@/lib/types';

export async function GET() {
    try {
        const projects = await getAllProjects();
        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error reading projects:', error);
        return NextResponse.json({ error: 'Failed to read projects' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, projectId, task, content, status, dueDate, parentLineNumber, updates } = body;

        // Find project path
        const projects = await getAllProjects();
        const project = projects.find((p) => p.id === projectId);

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        switch (action) {
            case 'add':
                addTask(project.path, content, status as TaskStatus, dueDate, parentLineNumber);
                break;

            case 'update':
                updateMarkdown(project.path, project.tasks);
                break;

            case 'updateTask':
                if (!task?.lineNumber) {
                    return NextResponse.json({ error: 'Line number required' }, { status: 400 });
                }
                updateTask(project.path, task.lineNumber, updates);
                break;

            case 'delete':
                if (!task?.lineNumber) {
                    return NextResponse.json({ error: 'Line number required' }, { status: 400 });
                }
                deleteTask(project.path, task.lineNumber);
                break;

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Return updated projects
        const updatedProjects = await getAllProjects();
        return NextResponse.json(updatedProjects);
    } catch (error) {
        console.error('Error updating project:', error);
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }
}
