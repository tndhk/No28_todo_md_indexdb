import fs from 'fs';
import path from 'path';
import { Project, Task, TaskStatus } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function getAllProjects(): Promise<Project[]> {
    if (!fs.existsSync(DATA_DIR)) {
        return [];
    }
    const files = fs.readdirSync(DATA_DIR).filter((file) => file.endsWith('.md'));
    return files.map((file) => {
        const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
        return parseMarkdown(file.replace('.md', ''), content, path.join(DATA_DIR, file));
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
            const content = textContent.replace(/#due:\d{4}-\d{2}-\d{2}/, '').trim();

            const newTask: Task = {
                id: `${id}-${lineNumber}`,
                content,
                status: isChecked ? 'done' : currentSection,
                dueDate,
                subtasks: [],
                rawLine: line,
                lineNumber,
            };

            // Handle Nesting
            while (taskStack.length > 0 && taskStack[taskStack.length - 1].indent >= indent) {
                taskStack.pop();
            }

            if (taskStack.length > 0) {
                const parent = taskStack[taskStack.length - 1].task;
                parent.subtasks.push(newTask);
                newTask.parentId = parent.id;
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
