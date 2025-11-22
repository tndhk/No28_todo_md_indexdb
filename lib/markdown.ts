import { promises as fsPromises } from 'fs';
import path from 'path';
import { Project, Task, TaskStatus, RepeatFrequency } from './types';
import { getConfig, shouldUseSupabase, getSupabaseStatus } from './config';
import { getAllProjects as getAllProjectsFromDB } from './supabase-adapter';
import { auth } from './auth';
import { securityLogger } from './logger';
import { getCachedProject } from './project-cache';
import {
    TASK_LINE_PATTERN,
    DUE_DATE_PATTERN,
    REPEAT_FREQUENCY_PATTERN,
    H1_HEADER_PATTERN,
    H2_HEADER_PATTERN,
} from './constants';

/**
 * Get all projects - uses Supabase by default, falls back to files if not configured
 */
export async function getAllProjects(): Promise<Project[]> {
    // Check if Supabase should be used
    const useSupabase = shouldUseSupabase();

    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
        const status = getSupabaseStatus();
        securityLogger.info(status, '[getAllProjects] Supabase status');
    }

    if (useSupabase) {
        // Get user from NextAuth session
        const session = await auth();
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
            securityLogger.info({
                hasSession: !!session,
                hasUserId: !!session?.user?.id,
                userId: session?.user?.id,
            }, '[getAllProjects] Auth session check');
        }

        if (!session?.user?.id) {
            throw new Error('Unauthorized: No user session found');
        }

        const projects = await getAllProjectsFromDB(session.user.id);
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
            securityLogger.info({
                projectCount: projects.length,
                userId: session.user.id,
            }, '[getAllProjects] Projects loaded from Supabase');
        }
        return projects;
    } else {
        // Fallback to file-based storage
        const config = getConfig();
        return getAllProjectsFromDir(config.dataDir);
    }
}

/**
 * Get all projects from a specific data directory
 * @param dataDir - The directory to read projects from
 * @optimization Replaced synchronous file operations with async parallelized versions
 */
export async function getAllProjectsFromDir(dataDir: string): Promise<Project[]> {
    const config = getConfig();

    // Use async directory check and creation
    try {
        await fsPromises.access(dataDir);
    } catch {
        await fsPromises.mkdir(dataDir, { recursive: true });
        return [];
    }

    // Read directory asynchronously
    const allFiles = await fsPromises.readdir(dataDir);
    const mdFiles = allFiles.filter((file) => file.endsWith('.md'));

    // Parallelize file reads using Promise.all instead of sequential reads
    const projects = await Promise.all(
        mdFiles.map(async (file) => {
            const filePath = path.join(dataDir, file);
            const content = await fsPromises.readFile(filePath, config.fileEncoding);
            return parseMarkdown(file.replace('.md', ''), content, filePath);
        })
    );

    return projects;
}

/**
 * Get a single project by ID from a specific data directory
 * @param dataDir - The directory to read project from
 * @param projectId - The project ID to retrieve
 * @param useCache - Whether to use cache (default: true)
 * @optimization Added to avoid reading all projects when only one is needed
 * @optimization Uses in-memory cache to reduce file I/O
 */
export async function getProjectByIdFromDir(
    dataDir: string,
    projectId: string,
    useCache = true
): Promise<Project | null> {
    const config = getConfig();
    const filePath = path.join(dataDir, `${projectId}.md`);

    // Use cache if enabled
    if (useCache) {
        return getCachedProject(dataDir, projectId, async () => {
            try {
                const content = await fsPromises.readFile(filePath, config.fileEncoding);
                return parseMarkdown(projectId, content, filePath);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    return null;
                }
                throw error;
            }
        });
    }

    // Without cache
    try {
        const content = await fsPromises.readFile(filePath, config.fileEncoding);
        return parseMarkdown(projectId, content, filePath);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

/**
 * Get a single project by ID - uses Supabase by default, falls back to files if not configured
 * @param projectId - The project ID to retrieve
 * @optimization Added to avoid reading all projects when only one is needed
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
    const useSupabase = shouldUseSupabase();

    if (useSupabase) {
        // Get user from NextAuth session
        const session = await auth();
        if (!session?.user?.id) {
            throw new Error('Unauthorized: No user session found');
        }

        // For Supabase mode, we still need to get all projects
        // But this is a DB query which is typically optimized with indexes
        const projects = await getAllProjectsFromDB(session.user.id);
        return projects.find((p) => p.id === projectId) || null;
    } else {
        // File-based storage: read only the specific file
        const config = getConfig();
        return getProjectByIdFromDir(config.dataDir, projectId);
    }
}

export function parseMarkdown(id: string, content: string, filePath: string): Project {
    const lines = content.split('\n');
    let title = id;
    const tasks: Task[] = [];
    let currentSection: TaskStatus = 'todo';
    const taskStack: { task: Task; indent: number }[] = [];

    lines.forEach((line, index) => {
        const lineNumber = index + 1;

        // Parse Title
        if (H1_HEADER_PATTERN.test(line)) {
            title = line.substring(2).trim();
            return;
        }

        // Parse Sections (Status)
        if (H2_HEADER_PATTERN.test(line)) {
            const sectionName = line.substring(3).trim().toLowerCase();
            if (sectionName.includes('todo')) currentSection = 'todo';
            else if (sectionName.includes('doing')) currentSection = 'doing';
            else if (sectionName.includes('done')) currentSection = 'done';
            return;
        }

        // Parse Tasks
        const taskMatch = line.match(TASK_LINE_PATTERN);
        if (taskMatch) {
            const indent = taskMatch[1].length;
            const isChecked = taskMatch[2] === 'x';
            const textContent = taskMatch[3];

            // OPTIMIZATION: Extract metadata and clean content in a more efficient way
            const dueMatch = textContent.match(DUE_DATE_PATTERN);
            const dueDate = dueMatch ? dueMatch[1] : undefined;

            const repeatMatch = textContent.match(REPEAT_FREQUENCY_PATTERN);
            const repeatFrequency = repeatMatch ? (repeatMatch[1] as RepeatFrequency) : undefined;

            // Remove all tags in a single replace using combined pattern for efficiency
            // This reduces multiple string operations to one
            const content = textContent
                .replace(/#(?:due:\d{4}-\d{2}-\d{2}|repeat:(?:daily|weekly|monthly))/g, '')
                .trim();

            // Handle Nesting
            while (taskStack.length > 0 && taskStack[taskStack.length - 1].indent >= indent) {
                taskStack.pop();
            }

            let parentContent: string | undefined;
            if (taskStack.length > 0) {
                parentContent = taskStack[taskStack.length - 1].task.content;
            }

            const newTask: Task = {
                id: `${id}-${lineNumber}`,
                content,
                status: isChecked ? 'done' : currentSection,
                dueDate,
                repeatFrequency,
                subtasks: [],
                parentId: taskStack.length > 0 ? taskStack[taskStack.length - 1].task.id : undefined,
                parentContent,
                rawLine: line,
                lineNumber,
            };

            if (taskStack.length > 0) {
                taskStack[taskStack.length - 1].task.subtasks.push(newTask);
            } else {
                tasks.push(newTask);
            }

            taskStack.push({ task: newTask, indent });
        }
    });

    return {
        id,
        title,
        tasks,
        path: filePath,
    };
}
