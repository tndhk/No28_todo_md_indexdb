import fs from 'fs';
import { Task, TaskStatus, Project, RepeatFrequency } from './types';
import { getConfig } from './config';

export function updateMarkdown(filePath: string, tasks: Task[]): void {
    const config = getConfig();
    const content = fs.readFileSync(filePath, config.fileEncoding);
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
            const repeatTag = task.repeatFrequency ? ` #repeat:${task.repeatFrequency}` : '';
            return `${indent}- ${checkbox} ${task.content}${dueTag}${repeatTag}`;
        }

        return line;
    });

    fs.writeFileSync(filePath, updatedLines.join('\n'), config.fileEncoding);
}

export function updateTask(
    filePath: string,
    lineNumber: number,
    updates: { content?: string; status?: TaskStatus; dueDate?: string; repeatFrequency?: RepeatFrequency }
): void {
    const config = getConfig();
    const content = fs.readFileSync(filePath, config.fileEncoding);
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

    const textContent = taskMatch[3];
    const currentContent = textContent
        .replace(/#due:\d{4}-\d{2}-\d{2}/, '')
        .replace(/#repeat:(daily|weekly|monthly)/, '')
        .trim();

    // Extract current repeat frequency
    const currentRepeatMatch = textContent.match(/#repeat:(daily|weekly|monthly)/);
    const currentRepeatFrequency = currentRepeatMatch ? (currentRepeatMatch[1] as RepeatFrequency) : undefined;

    // Apply updates
    const newContent = updates.content !== undefined ? updates.content : currentContent;
    const newStatus = updates.status !== undefined ? updates.status : (currentCheckbox === 'x' ? 'done' : 'todo');
    const newCheckbox = newStatus === 'done' ? '[x]' : '[ ]';
    const newDueTag = updates.dueDate ? ` #due:${updates.dueDate}` : '';
    const newRepeatFrequency = updates.repeatFrequency !== undefined ? updates.repeatFrequency : currentRepeatFrequency;
    const newRepeatTag = newRepeatFrequency ? ` #repeat:${newRepeatFrequency}` : '';

    lines[lineNumber - 1] = `${indent}- ${newCheckbox} ${newContent}${newDueTag}${newRepeatTag}`;

    fs.writeFileSync(filePath, lines.join('\n'), config.fileEncoding);
}

export function addTask(
    filePath: string,
    content: string,
    status: TaskStatus = 'todo',
    dueDate?: string,
    parentLineNumber?: number,
    repeatFrequency?: RepeatFrequency
): void {
    const config = getConfig();
    const fileContent = fs.readFileSync(filePath, config.fileEncoding);
    const lines = fileContent.split('\n');

    const checkbox = status === 'done' ? '[x]' : '[ ]';
    const dueTag = dueDate ? ` #due:${dueDate}` : '';
    const repeatTag = repeatFrequency ? ` #repeat:${repeatFrequency}` : '';
    const newTaskLine = `- ${checkbox} ${content}${dueTag}${repeatTag}`;
    const indentUnit = ' '.repeat(config.indentSpaces);

    if (parentLineNumber) {
        // Add as subtask
        const parentLine = lines[parentLineNumber - 1];
        const parentIndent = parentLine.match(/^(\s*)/)?.[1] || '';
        const childIndent = parentIndent + indentUnit;

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

    fs.writeFileSync(filePath, lines.join('\n'), config.fileEncoding);
}

export function deleteTask(filePath: string, lineNumber: number): void {
    const config = getConfig();
    const content = fs.readFileSync(filePath, config.fileEncoding);
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

    fs.writeFileSync(filePath, lines.join('\n'), config.fileEncoding);
}

export function rewriteMarkdown(filePath: string, project: Project): void {
    const config = getConfig();
    const lines: string[] = [];

    // Title
    lines.push(`# ${project.title}`);
    lines.push('');

    // Helper to write tasks recursively
    const indentUnit = ' '.repeat(config.indentSpaces);
    function writeTasks(tasks: Task[], indentLevel: number = 0) {
        tasks.forEach(task => {
            const indent = indentUnit.repeat(indentLevel);
            const checkbox = task.status === 'done' ? '[x]' : '[ ]';
            const dueTag = task.dueDate ? ` #due:${task.dueDate}` : '';
            const repeatTag = task.repeatFrequency ? ` #repeat:${task.repeatFrequency}` : '';
            lines.push(`${indent}- ${checkbox} ${task.content}${dueTag}${repeatTag}`);

            if (task.subtasks.length > 0) {
                writeTasks(task.subtasks, indentLevel + 1);
            }
        });
    }

    // Group tasks by status for sections
    const todoTasks = project.tasks.filter(t => t.status === 'todo');
    const doingTasks = project.tasks.filter(t => t.status === 'doing');
    const doneTasks = project.tasks.filter(t => t.status === 'done');

    // Todo Section
    if (todoTasks.length > 0) {
        lines.push('## Todo');
        writeTasks(todoTasks);
        lines.push('');
    }

    // Doing Section
    if (doingTasks.length > 0) {
        lines.push('## Doing');
        writeTasks(doingTasks);
        lines.push('');
    }

    // Done Section
    if (doneTasks.length > 0) {
        lines.push('## Done');
        writeTasks(doneTasks);
        lines.push('');
    }

    // Write to file
    fs.writeFileSync(filePath, lines.join('\n'), config.fileEncoding);
}

/**
 * Calculate the next due date based on repeat frequency
 */
export function calculateNextDueDate(currentDueDate: string, repeatFrequency: RepeatFrequency): string {
    const date = new Date(currentDueDate + 'T00:00:00');

    switch (repeatFrequency) {
        case 'daily':
            date.setDate(date.getDate() + 1);
            break;
        case 'weekly':
            date.setDate(date.getDate() + 7);
            break;
        case 'monthly':
            date.setMonth(date.getMonth() + 1);
            break;
    }

    // Format as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Handle recurring task completion
 * Marks the task as done and creates a new recurring task with the next due date
 */
export function handleRecurringTask(
    filePath: string,
    task: Task
): void {
    if (!task.repeatFrequency) {
        throw new Error('Task does not have a repeat frequency');
    }

    // Mark current task as done
    updateTask(filePath, task.lineNumber, { status: 'done' });

    // Calculate next due date
    const nextDueDate = task.dueDate
        ? calculateNextDueDate(task.dueDate, task.repeatFrequency)
        : undefined;

    // Add new recurring task with same content, repeat frequency, but new due date
    addTask(
        filePath,
        task.content,
        'todo',
        nextDueDate,
        task.parentId ? parseInt(task.parentId.split('-').pop() || '0') : undefined,
        task.repeatFrequency
    );
}

/**
 * Creates a new project file with the given title
 * @param filePath - Path to the new markdown file
 * @param title - Project title
 */
export function createProjectFile(filePath: string, title: string): void {
    const config = getConfig();

    // Create initial markdown content with just the title
    const content = `# ${title}\n`;

    fs.writeFileSync(filePath, content, config.fileEncoding);
}
