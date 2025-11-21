import { Project, Task } from './types';
import { getConfig } from './config';

/**
 * Generates Markdown string from Project object
 * This is the INVERSE of parseMarkdown() in lib/markdown.ts
 * Used for displaying data from database in Markdown format
 */
export function renderMarkdown(project: Project): string {
    const lines: string[] = [];

    // Title
    lines.push(`# ${project.title}`);
    lines.push('');

    // Group tasks by status
    const todoTasks = project.tasks.filter(t => t.status === 'todo');
    const doingTasks = project.tasks.filter(t => t.status === 'doing');
    const doneTasks = project.tasks.filter(t => t.status === 'done');

    // Render sections
    if (todoTasks.length > 0) {
        lines.push('## Todo');
        renderTasks(todoTasks, lines);
        lines.push('');
    }

    if (doingTasks.length > 0) {
        lines.push('## Doing');
        renderTasks(doingTasks, lines);
        lines.push('');
    }

    if (doneTasks.length > 0) {
        lines.push('## Done');
        renderTasks(doneTasks, lines);
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Recursively renders tasks to markdown lines
 */
function renderTasks(tasks: Task[], lines: string[], indentLevel = 0) {
    const config = getConfig();
    const indent = ' '.repeat(config.indentSpaces).repeat(indentLevel);

    tasks.forEach(task => {
        const line = renderTaskLine(task, indentLevel);
        lines.push(line);

        // Store as rawLine for compatibility
        task.rawLine = line;

        if (task.subtasks.length > 0) {
            renderTasks(task.subtasks, lines, indentLevel + 1);
        }
    });
}

/**
 * Generate rawLine for a single task
 * Used in API responses to populate task.rawLine field
 */
export function renderTaskLine(task: Task, indentLevel = 0): string {
    const config = getConfig();
    const indent = ' '.repeat(config.indentSpaces * indentLevel);
    const checkbox = task.status === 'done' ? '[x]' : '[ ]';
    const dueTag = task.dueDate ? ` #due:${task.dueDate}` : '';
    const repeatTag = task.repeatFrequency ? ` #repeat:${task.repeatFrequency}` : '';

    return `${indent}- ${checkbox} ${task.content}${dueTag}${repeatTag}`;
}

/**
 * Calculate indent level for a task based on its parent chain
 */
export function getIndentLevel(task: Task, taskMap?: Map<string, Task>): number {
    let level = 0;
    let current = task;

    // If we don't have a taskMap, we can't calculate properly
    if (!taskMap) {
        return 0;
    }

    while (current.parentId) {
        level++;
        const parent = taskMap.get(current.parentId);
        if (!parent) break;
        current = parent;
    }

    return level;
}

/**
 * Assign line numbers to tasks in tree structure
 * Modifies tasks in-place
 */
export function assignLineNumbers(tasks: Task[], startLine = 1): number {
    let currentLine = startLine;

    function assignRecursive(taskList: Task[]) {
        taskList.forEach(task => {
            task.lineNumber = currentLine++;
            if (task.subtasks.length > 0) {
                assignRecursive(task.subtasks);
            }
        });
    }

    assignRecursive(tasks);
    return currentLine;
}

/**
 * Generate rawLine for all tasks in tree
 * Modifies tasks in-place
 */
export function assignRawLines(tasks: Task[], taskMap?: Map<string, Task>, indentLevel = 0) {
    tasks.forEach(task => {
        const level = taskMap ? getIndentLevel(task, taskMap) : indentLevel;
        task.rawLine = renderTaskLine(task, level);
        if (task.subtasks.length > 0) {
            assignRawLines(task.subtasks, taskMap, indentLevel + 1);
        }
    });
}
