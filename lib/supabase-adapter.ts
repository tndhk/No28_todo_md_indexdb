import { supabaseAdmin, DbTask } from './supabase-client';
import { Project, Task, TaskStatus, RepeatFrequency } from './types';
import { assignLineNumbers, assignRawLines } from './markdown-renderer';
import { calculateNextDueDate } from './markdown-updater';
import { securityLogger } from './logger';

/**
 * Get all projects for a user
 */
export async function getAllProjects(userId: string): Promise<Project[]> {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
        securityLogger.info({
            hasSupabaseAdmin: !!supabaseAdmin,
            userId,
        }, '[supabase-adapter.getAllProjects] Starting');
    }

    if (!supabaseAdmin) {
        throw new Error('Supabase is not configured');
    }

    // Fetch projects
    const { data: projects, error: projectsError } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
        securityLogger.info({
            projectCount: projects?.length || 0,
            hasError: !!projectsError,
            error: projectsError?.message,
        }, '[supabase-adapter.getAllProjects] Projects fetched');
    }

    if (projectsError) {
        throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    if (!projects || projects.length === 0) {
        return [];
    }

    // Fetch all tasks for these projects
    const projectIds = projects.map(p => p.id);
    const { data: tasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('*')
        .in('project_id', projectIds)
        .order('display_order', { ascending: true });

    if (tasksError) {
        throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
    }

    // Group tasks by project
    const tasksByProject = new Map<string, DbTask[]>();
    tasks?.forEach(task => {
        if (!tasksByProject.has(task.project_id)) {
            tasksByProject.set(task.project_id, []);
        }
        tasksByProject.get(task.project_id)!.push(task);
    });

    // Build Project objects
    const result: Project[] = projects.map(project => {
        const projectTasks = tasksByProject.get(project.id) || [];
        const taskTree = buildTaskHierarchy(projectTasks);

        // Assign line numbers and rawLines
        assignLineNumbers(taskTree);
        const taskMap = buildTaskMap(taskTree);
        assignRawLines(taskTree, taskMap);

        return {
            id: project.id,
            title: project.title,
            tasks: taskTree,
            path: '', // No file path in DB mode
        };
    });

    return result;
}

/**
 * Get a single project by ID
 */
export async function getProject(projectId: string, userId: string): Promise<Project | null> {
    if (!supabaseAdmin) {
        throw new Error('Supabase is not configured');
    }

    const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single();

    if (projectError || !project) {
        return null;
    }

    const { data: tasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order', { ascending: true });

    if (tasksError) {
        throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
    }

    const taskTree = buildTaskHierarchy(tasks || []);
    assignLineNumbers(taskTree);
    const taskMap = buildTaskMap(taskTree);
    assignRawLines(taskTree, taskMap);

    return {
        id: project.id,
        title: project.title,
        tasks: taskTree,
        path: '',
    };
}

/**
 * Create a new project
 */
export async function createProject(userId: string, projectId: string, title: string): Promise<Project> {
    if (!supabaseAdmin) {
        throw new Error('Supabase is not configured');
    }

    const { data, error } = await supabaseAdmin
        .from('projects')
        .insert({
            id: projectId,
            user_id: userId,
            title,
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create project: ${error.message}`);
    }

    return {
        id: data.id,
        title: data.title,
        tasks: [],
        path: '',
    };
}

/**
 * Update a task
 */
export async function updateTask(
    taskId: string,
    updates: Partial<{
        content: string;
        status: TaskStatus;
        dueDate: string | undefined;
        repeatFrequency: RepeatFrequency | undefined;
    }>
): Promise<void> {
    if (!supabaseAdmin) {
        throw new Error('Supabase is not configured');
    }

    const dbUpdates: Partial<DbTask> = {};

    if (updates.content !== undefined) {
        dbUpdates.content = updates.content;
    }

    if (updates.status !== undefined) {
        dbUpdates.status = updates.status;
        dbUpdates.completed = updates.status === 'done';
    }

    if (updates.dueDate !== undefined) {
        dbUpdates.due_date = updates.dueDate || null;
    }

    if (updates.repeatFrequency !== undefined) {
        dbUpdates.repeat_frequency = updates.repeatFrequency || null;
    }

    const { error } = await supabaseAdmin
        .from('tasks')
        .update(dbUpdates)
        .eq('id', taskId);

    if (error) {
        throw new Error(`Failed to update task: ${error.message}`);
    }
}

/**
 * Add a new task
 */
export async function addTask(
    projectId: string,
    content: string,
    status: TaskStatus = 'todo',
    dueDate?: string,
    parentId?: string,
    repeatFrequency?: RepeatFrequency
): Promise<Task> {
    if (!supabaseAdmin) {
        throw new Error('Supabase is not configured');
    }

    // Calculate display_order and indent_level
    let displayOrder = 0;
    let indentLevel = 0;
    let lineNumber = 1;

    if (parentId) {
        // Adding as subtask
        const { data: parentTask, error: parentError } = await supabaseAdmin
            .from('tasks')
            .select('*')
            .eq('id', parentId)
            .single();

        if (parentError) {
            throw new Error(`Failed to find parent task: ${parentError.message}`);
        }

        indentLevel = parentTask.indent_level + 1;

        // Find the last child of the parent
        const { data: siblings, error: siblingsError } = await supabaseAdmin
            .from('tasks')
            .select('display_order')
            .eq('parent_id', parentId)
            .order('display_order', { ascending: false })
            .limit(1);

        if (siblingsError) {
            throw new Error(`Failed to fetch siblings: ${siblingsError.message}`);
        }

        displayOrder = siblings && siblings.length > 0 ? siblings[0].display_order + 1 : parentTask.display_order + 1;
    } else {
        // Adding as top-level task in the status section
        const { data: lastTask, error: lastError } = await supabaseAdmin
            .from('tasks')
            .select('display_order, line_number')
            .eq('project_id', projectId)
            .eq('status', status)
            .is('parent_id', null)
            .order('display_order', { ascending: false })
            .limit(1);

        if (lastError) {
            throw new Error(`Failed to fetch last task: ${lastError.message}`);
        }

        if (lastTask && lastTask.length > 0) {
            displayOrder = lastTask[0].display_order + 1;
            lineNumber = lastTask[0].line_number + 1;
        } else {
            // First task in section, find max display_order
            const { data: maxTask } = await supabaseAdmin
                .from('tasks')
                .select('display_order, line_number')
                .eq('project_id', projectId)
                .order('display_order', { ascending: false })
                .limit(1);

            if (maxTask && maxTask.length > 0) {
                displayOrder = maxTask[0].display_order + 1;
                lineNumber = maxTask[0].line_number + 1;
            }
        }
    }

    // Generate task ID
    const taskId = `${projectId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert({
            id: taskId,
            project_id: projectId,
            parent_id: parentId || null,
            content,
            status,
            completed: status === 'done',
            due_date: dueDate || null,
            repeat_frequency: repeatFrequency || null,
            indent_level: indentLevel,
            display_order: displayOrder,
            line_number: lineNumber,
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to add task: ${error.message}`);
    }

    return dbTaskToTask(data);
}

/**
 * Delete all tasks for a project
 */
export async function deleteAllTasksForProject(projectId: string): Promise<void> {
    if (!supabaseAdmin) {
        throw new Error('Supabase is not configured');
    }

    const { error } = await supabaseAdmin
        .from('tasks')
        .delete()
        .eq('project_id', projectId);

    if (error) {
        throw new Error(`Failed to delete all tasks for project: ${error.message}`);
    }
}

/**
 * Delete a task and all its subtasks
 */
export async function deleteTask(taskId: string): Promise<void> {
    if (!supabaseAdmin) {
        throw new Error('Supabase is not configured');
    }

    // Get all subtasks recursively
    const subtaskIds = await getSubtaskIds(taskId);

    // Delete all tasks (parent + all children)
    const { error } = await supabaseAdmin
        .from('tasks')
        .delete()
        .in('id', [taskId, ...subtaskIds]);

    if (error) {
        throw new Error(`Failed to delete task: ${error.message}`);
    }
}

/**
 * Recursively get all subtask IDs
 */
async function getSubtaskIds(parentId: string): Promise<string[]> {
    if (!supabaseAdmin) {
        return [];
    }

    const { data: children } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('parent_id', parentId);

    if (!children || children.length === 0) {
        return [];
    }

    const childIds = children.map(c => c.id);
    const grandchildIds = await Promise.all(
        childIds.map(id => getSubtaskIds(id))
    );

    return [...childIds, ...grandchildIds.flat()];
}

/**
 * Reorder tasks (used for drag-and-drop)
 */
export async function reorderTasks(projectId: string, tasks: Task[]): Promise<void> {
    if (!supabaseAdmin) {
        throw new Error('Supabase is not configured');
    }

    // Store in local variable for TypeScript null check
    const client = supabaseAdmin;

    // Flatten task tree and assign new display_order
    const flatTasks: { id: string; display_order: number; line_number: number }[] = [];
    let order = 0;
    let line = 1;

    function flatten(taskList: Task[]) {
        taskList.forEach(task => {
            flatTasks.push({
                id: task.id,
                display_order: order++,
                line_number: line++,
            });
            if (task.subtasks.length > 0) {
                flatten(task.subtasks);
            }
        });
    }

    flatten(tasks);

    // Batch update
    const updates = flatTasks.map(({ id, display_order, line_number }) =>
        client
            .from('tasks')
            .update({ display_order, line_number })
            .eq('id', id)
    );

    await Promise.all(updates);
}

/**
 * Handle recurring task completion
 */
export async function handleRecurringTask(task: Task, projectId: string): Promise<void> {
    // Mark current task as done
    await updateTask(task.id, { status: 'done' });

    // Calculate next due date
    const nextDueDate = task.dueDate
        ? calculateNextDueDate(task.dueDate, task.repeatFrequency!)
        : undefined;

    // Add new recurring task
    await addTask(
        projectId,
        task.content,
        'todo',
        nextDueDate,
        task.parentId,
        task.repeatFrequency
    );
}

/**
 * Build task hierarchy from flat database rows
 */
function buildTaskHierarchy(rows: DbTask[]): Task[] {
    const taskMap = new Map<string, Task>();
    const rootTasks: Task[] = [];

    // Sort by display_order
    rows.sort((a, b) => a.display_order - b.display_order);

    // Build flat map
    rows.forEach(row => {
        taskMap.set(row.id, dbTaskToTask(row));
    });

    // Build hierarchy
    taskMap.forEach(task => {
        if (task.parentId) {
            const parent = taskMap.get(task.parentId);
            if (parent) {
                parent.subtasks.push(task);
                task.parentContent = parent.content;
            }
        } else {
            rootTasks.push(task);
        }
    });

    return rootTasks;
}

/**
 * Build a flat map of tasks for quick lookup
 */
function buildTaskMap(tasks: Task[]): Map<string, Task> {
    const map = new Map<string, Task>();

    function addToMap(taskList: Task[]) {
        taskList.forEach(task => {
            map.set(task.id, task);
            if (task.subtasks.length > 0) {
                addToMap(task.subtasks);
            }
        });
    }

    addToMap(tasks);
    return map;
}

/**
 * Convert database task to Task interface
 */
function dbTaskToTask(dbTask: DbTask): Task {
    return {
        id: dbTask.id,
        content: dbTask.content,
        status: dbTask.status,
        dueDate: dbTask.due_date || undefined,
        repeatFrequency: dbTask.repeat_frequency || undefined,
        subtasks: [],
        parentId: dbTask.parent_id || undefined,
        parentContent: undefined, // Set during hierarchy building
        rawLine: '', // Set by assignRawLines
        lineNumber: dbTask.line_number,
    };
}
