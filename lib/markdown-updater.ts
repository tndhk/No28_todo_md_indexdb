import fs from 'fs';
import { Task, TaskStatus, Project, RepeatFrequency } from './types';
import { getConfig } from './config';
import {
    TASK_LINE_PATTERN,
    DUE_DATE_PATTERN,
    REPEAT_FREQUENCY_PATTERN,
} from './constants';

/**
 * Updates multiple tasks in a markdown file based on their line numbers
 * @param filePath - Path to the markdown file
 * @param tasks - Array of tasks with updated data
 * @optimization Only update lines that changed to reduce memory allocation
 */
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

    // Update only modified lines in-place - more memory efficient
    taskMap.forEach((task, lineNumber) => {
        const index = lineNumber - 1;
        if (index >= 0 && index < lines.length) {
            const line = lines[index];
            const indent = line.match(/^(\s*)/)?.[1] || '';
            const checkbox = task.status === 'done' ? '[x]' : '[ ]';
            const dueTag = task.dueDate ? ` #due:${task.dueDate}` : '';
            const repeatTag = task.repeatFrequency ? ` #repeat:${task.repeatFrequency}` : '';
            lines[index] = `${indent}- ${checkbox} ${task.content}${dueTag}${repeatTag}`;
        }
    });

    fs.writeFileSync(filePath, lines.join('\n'), config.fileEncoding);
}

/**
 * Updates a single task at a specific line number
 * @param filePath - Path to the markdown file
 * @param lineNumber - Line number of the task (1-indexed)
 * @param updates - Partial updates to apply (content, status, dueDate, repeatFrequency)
 * @throws {Error} If the line number is invalid or the line is not a task
 */
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
    const taskMatch = line.match(TASK_LINE_PATTERN);
    if (!taskMatch) {
        throw new Error('Invalid task line');
    }

    const textContent = taskMatch[3];
    const currentContent = textContent
        .replace(DUE_DATE_PATTERN, '')
        .replace(REPEAT_FREQUENCY_PATTERN, '')
        .trim();

    // Extract current repeat frequency
    const currentRepeatMatch = textContent.match(REPEAT_FREQUENCY_PATTERN);
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

/**
 * Helper: Formats a task line with proper checkbox, due date, and repeat tags
 */
function formatTaskLine(
    content: string,
    status: TaskStatus,
    dueDate?: string,
    repeatFrequency?: RepeatFrequency
): string {
    const checkbox = status === 'done' ? '[x]' : '[ ]';
    const dueTag = dueDate ? ` #due:${dueDate}` : '';
    const repeatTag = repeatFrequency ? ` #repeat:${repeatFrequency}` : '';
    return `- ${checkbox} ${content}${dueTag}${repeatTag}`;
}

/**
 * Helper: Finds the insertion index for a subtask under a parent
 */
function findSubtaskInsertionIndex(
    lines: string[],
    parentLineNumber: number,
    parentIndentLength: number
): number {
    let insertIndex = parentLineNumber;
    for (let i = parentLineNumber; i < lines.length; i++) {
        const line = lines[i];
        const currentIndent = line.match(/^(\s*)/)?.[1] || '';
        if (currentIndent.length <= parentIndentLength && line.trim()) {
            break;
        }
        insertIndex = i + 1;
    }
    return insertIndex;
}

/**
 * Helper: Finds the insertion index for a task in a section
 */
function findSectionInsertionIndex(
    lines: string[],
    sectionIndex: number
): number {
    let insertIndex = sectionIndex + 1;
    for (let i = sectionIndex + 1; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) {
            break;
        }
        if (lines[i].trim()) {
            insertIndex = i + 1;
        }
    }
    return insertIndex;
}

/**
 * Helper: Finds or creates a section header for a given status
 */
function findOrCreateSection(
    lines: string[],
    status: TaskStatus
): number {
    const sectionName = getSectionName(status);

    // Try to find existing section
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(new RegExp(`^## ${sectionName}`, 'i'))) {
            return i;
        }
    }

    // Section doesn't exist, create it
    lines.push(`\n## ${sectionName}`);
    return lines.length - 1;
}

/**
 * Helper: Maps task status to section name
 */
function getSectionName(status: TaskStatus): string {
    switch (status) {
        case 'doing':
            return 'Doing';
        case 'done':
            return 'Done';
        case 'todo':
        default:
            return 'Todo';
    }
}

/**
 * Adds a new task to the markdown file
 * @param filePath - Path to the markdown file
 * @param content - Task content (without tags)
 * @param status - Task status (determines section placement)
 * @param dueDate - Optional due date in YYYY-MM-DD format
 * @param parentLineNumber - Optional parent task line number (for subtasks)
 * @param repeatFrequency - Optional repeat frequency for recurring tasks
 * @throws {Error} If the file cannot be read or written
 */
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

    const newTaskLine = formatTaskLine(content, status, dueDate, repeatFrequency);
    const indentUnit = ' '.repeat(config.indentSpaces);

    if (parentLineNumber) {
        // Add as subtask
        const parentLine = lines[parentLineNumber - 1];
        const parentIndent = parentLine.match(/^(\s*)/)?.[1] || '';
        const childIndent = parentIndent + indentUnit;

        const insertIndex = findSubtaskInsertionIndex(
            lines,
            parentLineNumber,
            parentIndent.length
        );

        lines.splice(insertIndex, 0, `${childIndent}${newTaskLine}`);
    } else {
        // Add to the appropriate section
        const sectionIndex = findOrCreateSection(lines, status);
        const insertIndex = findSectionInsertionIndex(lines, sectionIndex);

        lines.splice(insertIndex, 0, newTaskLine);
    }

    fs.writeFileSync(filePath, lines.join('\n'), config.fileEncoding);
}

/**
 * Deletes a task and all its subtasks from a markdown file
 * @param filePath - Path to the markdown file
 * @param lineNumber - Line number of the task to delete (1-indexed)
 * @optimization Improved from O(n²) to O(n) by using filter instead of multiple splice operations
 */
export function deleteTask(filePath: string, lineNumber: number): void {
    const config = getConfig();
    const content = fs.readFileSync(filePath, config.fileEncoding);
    const lines = content.split('\n');

    const targetLine = lines[lineNumber - 1];
    const targetIndent = targetLine.match(/^(\s*)/)?.[1]?.length || 0;

    // Mark deletion range
    let deleteUntil = lineNumber; // exclusive end index (0-indexed)
    for (let i = lineNumber; i < lines.length; i++) {
        const line = lines[i];
        const currentIndent = line.match(/^(\s*)/)?.[1]?.length || 0;

        if (line.trim() && currentIndent <= targetIndent) {
            break;
        }
        deleteUntil = i + 1;
    }

    // Filter out deleted lines in one pass - O(n) instead of O(n²)
    const deleteStart = lineNumber - 1; // inclusive start index (0-indexed)
    const filteredLines = lines.filter((_, index) =>
        index < deleteStart || index >= deleteUntil
    );

    fs.writeFileSync(filePath, filteredLines.join('\n'), config.fileEncoding);
}

/**
 * Completely rewrites a markdown file with the given project data
 * Used for major reorganizations like reordering or bulk updates
 * @param filePath - Path to the markdown file
 * @param project - Complete project data to write
 */
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
            const taskLine = formatTaskLine(
                task.content,
                task.status,
                task.dueDate,
                task.repeatFrequency
            );
            lines.push(`${indent}${taskLine}`);

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

/**
 * Updates the project title (H1) in a markdown file
 * @param filePath - Path to the markdown file
 * @param newTitle - New project title
 */
export function updateProjectTitle(filePath: string, newTitle: string): void {
    const config = getConfig();

    // Read current content
    const content = fs.readFileSync(filePath, config.fileEncoding);
    const lines = content.split('\n');

    // Find and update the first H1 heading
    let updated = false;
    const updatedLines = lines.map(line => {
        if (!updated && line.startsWith('# ')) {
            updated = true;
            return `# ${newTitle}`;
        }
        return line;
    });

    // If no H1 found, add it at the beginning
    if (!updated) {
        updatedLines.unshift(`# ${newTitle}`);
    }

    fs.writeFileSync(filePath, updatedLines.join('\n'), config.fileEncoding);
}
