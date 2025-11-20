import fs from 'fs';
import path from 'path';
import { Project, Task, TaskStatus, RepeatFrequency } from './types';
import { getConfig } from './config';

/**
 * Get all projects from the default data directory
 */
export async function getAllProjects(): Promise<Project[]> {
    const config = getConfig();
    return getAllProjectsFromDir(config.dataDir);
}

/**
 * Get all projects from a specific data directory
 * @param dataDir - The directory to read projects from
 */
export async function getAllProjectsFromDir(dataDir: string): Promise<Project[]> {
    const config = getConfig();

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        return [];
    }
    const files = fs.readdirSync(dataDir).filter((file) => file.endsWith('.md'));
    return files.map((file) => {
        const content = fs.readFileSync(path.join(dataDir, file), config.fileEncoding);
        return parseMarkdown(file.replace('.md', ''), content, path.join(dataDir, file));
    });
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
        if (line.startsWith('# ')) {
            title = line.substring(2).trim();
            return;
        }

        // Parse Sections (Status)
        if (line.startsWith('## ')) {
            const sectionName = line.substring(3).trim().toLowerCase();
            if (sectionName.includes('todo')) currentSection = 'todo';
            else if (sectionName.includes('doing')) currentSection = 'doing';
            else if (sectionName.includes('done')) currentSection = 'done';
            return;
        }

        // Parse Tasks
        const taskMatch = line.match(/^(\s*)- \[(x| )\] (.*)/);
        if (taskMatch) {
            const indent = taskMatch[1].length;
            const isChecked = taskMatch[2] === 'x';
            const textContent = taskMatch[3];

            // Extract Due Date
            const dueMatch = textContent.match(/#due:(\d{4}-\d{2}-\d{2})/);
            const dueDate = dueMatch ? dueMatch[1] : undefined;

            // Extract Repeat Frequency
            const repeatMatch = textContent.match(/#repeat:(daily|weekly|monthly)/);
            const repeatFrequency = repeatMatch ? (repeatMatch[1] as RepeatFrequency) : undefined;

            // Remove tags from content
            const content = textContent
                .replace(/#due:\d{4}-\d{2}-\d{2}/, '')
                .replace(/#repeat:(daily|weekly|monthly)/, '')
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
