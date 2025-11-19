import fs from 'fs';
import path from 'path';
import { Task, TaskStatus } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

export function updateMarkdown(filePath: string, tasks: Task[]): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Create a map of line numbers to updated tasks
    const taskMap = new Map<number, Task>();
    function mapTasks(taskList: Task[]) {
        taskList.forEach((task) => {
            taskMap.set(task.lineNumber, task);
            if (task.subtasks.length > 0) {
                mapTasks(task.subtasks);
            }
        });
    }
    mapTasks(tasks);

    // Update lines
    const updatedLines = lines.map((line, index) => {
        const lineNumber = index + 1;
        const task = taskMap.get(lineNumber);

        if (task) {
            const indent = line.match(/^(\s*)/)?.[1] || '';
            const checkbox = task.status === 'done' ? '[x]' : '[ ]';
            const dueTag = task.dueDate ? ` #due:${task.dueDate}` : '';
            return `${indent}- ${checkbox} ${task.content}${dueTag}`;
        }

        return line;
    });

    fs.writeFileSync(filePath, updatedLines.join('\n'), 'utf-8');
}

export function updateTask(
    filePath: string,
    lineNumber: number,
    updates: { content?: string; status?: TaskStatus; dueDate?: string }
): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    if (lineNumber < 1 || lineNumber > lines.length) {
        throw new Error('Invalid line number');
    }

    const line = lines[lineNumber - 1];
    const indent = line.match(/^(\s*)/)?.[1] || '';
    const currentCheckbox = line.match(/- \[(x| )\]/)?.[1] || ' ';

    // Parse current task
    const taskMatch = line.match(/^(\s*)- \[(x| )\] (.*)/);
    if (!taskMatch) {
        throw new Error('Invalid task line');
    }

    const currentContent = taskMatch[3].replace(/#due:\d{4}-\d{2}-\d{2}/, '').trim();

    // Apply updates
    const newContent = updates.content !== undefined ? updates.content : currentContent;
    const newStatus = updates.status !== undefined ? updates.status : (currentCheckbox === 'x' ? 'done' : 'todo');
    const newCheckbox = newStatus === 'done' ? '[x]' : '[ ]';
    const newDueTag = updates.dueDate ? ` #due:${updates.dueDate}` : '';

    lines[lineNumber - 1] = `${indent}- ${newCheckbox} ${newContent}${newDueTag}`;

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

export function addTask(
    filePath: string,
    content: string,
    status: TaskStatus = 'todo',
    dueDate?: string,
    parentLineNumber?: number
): void {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    const checkbox = status === 'done' ? '[x]' : '[ ]';
    const dueTag = dueDate ? ` #due:${dueDate}` : '';
    const newTaskLine = `- ${checkbox} ${content}${dueTag}`;

    if (parentLineNumber) {
        // Add as subtask
        const parentLine = lines[parentLineNumber - 1];
        const parentIndent = parentLine.match(/^(\s*)/)?.[1] || '';
        const childIndent = parentIndent + '    ';

        // Find the last child of the parent
        let insertIndex = parentLineNumber;
        for (let i = parentLineNumber; i < lines.length; i++) {
            const line = lines[i];
            const currentIndent = line.match(/^(\s*)/)?.[1] || '';
            if (currentIndent.length <= parentIndent.length && line.trim()) {
                break;
            }
            insertIndex = i + 1;
        }

        lines.splice(insertIndex, 0, `${childIndent}${newTaskLine}`);
    } else {
        // Add to the appropriate section
        let sectionName = 'Todo';
        if (status === 'doing') sectionName = 'Doing';
        if (status === 'done') sectionName = 'Done';

        let sectionIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(new RegExp(`^## ${sectionName}`, 'i'))) {
                sectionIndex = i;
                break;
            }
        }

        if (sectionIndex === -1) {
            // Section doesn't exist, create it
            lines.push(`\n## ${sectionName}`);
            lines.push(newTaskLine);
        } else {
            // Find the end of the section
            let insertIndex = sectionIndex + 1;
            for (let i = sectionIndex + 1; i < lines.length; i++) {
                if (lines[i].startsWith('## ')) {
                    break;
                }
                if (lines[i].trim()) {
                    insertIndex = i + 1;
                }
            }
            lines.splice(insertIndex, 0, newTaskLine);
        }
    }

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

export function deleteTask(filePath: string, lineNumber: number): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const targetLine = lines[lineNumber - 1];
    const targetIndent = targetLine.match(/^(\s*)/)?.[1]?.length || 0;

    // Find all child lines to delete
    const linesToDelete = [lineNumber - 1];
    for (let i = lineNumber; i < lines.length; i++) {
        const line = lines[i];
        const currentIndent = line.match(/^(\s*)/)?.[1]?.length || 0;

        if (line.trim() && currentIndent <= targetIndent) {
            break;
        }
        linesToDelete.push(i);
    }

    // Delete lines in reverse order
    linesToDelete.reverse().forEach((index) => {
        lines.splice(index, 1);
    });

    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}
