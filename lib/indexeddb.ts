import { Project, Task, TaskStatus, RepeatFrequency, Group } from './types';

const DB_NAME = 'MarkdownTodoDB';
const DB_VERSION = 2;
const PROJECTS_STORE = 'projects';

let projectChangeCallback: ((project: Project) => void) | null = null;

export function setProjectChangeCallback(callback: ((project: Project) => void) | null) {
  projectChangeCallback = callback;
}

/**
 * Initialize IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const oldVersion = event.oldVersion;

            // Create projects store
            if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
                const projectStore = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
                projectStore.createIndex('title', 'title', { unique: false });
            }

            // Migration from v1 to v2: convert tasks to groups
            if (oldVersion < 2) {
                const transaction = (event as IDBVersionChangeEvent).target as IDBOpenDBRequest;
                const store = (transaction.transaction as IDBTransaction).objectStore(PROJECTS_STORE);
                const getAllRequest = store.getAll();

                getAllRequest.onsuccess = () => {
                    // Legacy project format with tasks array
                    const projects = getAllRequest.result as Array<Omit<Project, 'groups'> & { tasks?: Task[] }>;
                    projects.forEach((project) => {
                        // Migrate old format with tasks array to new format with groups
                        if (project.tasks && !('groups' in project)) {
                            const defaultGroup: Group = {
                                id: `${project.id}-default-group`,
                                name: 'Default',
                                tasks: project.tasks,
                            };
                            (project as unknown as Project).groups = [defaultGroup];
                            delete project.tasks;
                            store.put(project);
                        }
                    });
                };
            }
        };
    });
}

/**
 * Get all projects from IndexedDB
 */
export async function getAllProjects(): Promise<Project[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECTS_STORE, 'readonly');
        const store = transaction.objectStore(PROJECTS_STORE);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get a single project by ID
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECTS_STORE, 'readonly');
        const store = transaction.objectStore(PROJECTS_STORE);
        const request = store.get(projectId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Add a new project
 */
export async function addProject(
    project: Omit<Project, 'path'>,
): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);

        // Add path as empty string for IndexedDB mode
        const projectWithPath: Project = { ...project, path: '' };
        const request = store.add(projectWithPath);

        request.onsuccess = () => {
            if (projectChangeCallback) {
                projectChangeCallback(projectWithPath);
            }
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Put (upsert) a project - inserts if new, updates if exists
 * This is safer for sync operations as it doesn't require the project to pre-exist
 */
export async function putProject(project: Omit<Project, 'path'>, options?: { silent?: boolean }): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);

        // Add path as empty string for IndexedDB mode
        const projectWithPath: Project = { ...project, path: '' };
        const request = store.put(projectWithPath);

        request.onsuccess = () => {
            console.log('[IDB] Project upserted:', projectWithPath.id, options?.silent ? '(silent)' : '');
            // Only trigger callback if not silent (prevents sync loops during downstream sync)
            if (projectChangeCallback && !options?.silent) {
                projectChangeCallback(projectWithPath);
            }
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Update an existing project
 * @performance Fixed async Promise constructor anti-pattern
 */
export async function updateProject(
    project: Partial<Project> & { id: string },
): Promise<void> {
    const db = await openDatabase();
    // PERFORMANCE: Removed async Promise constructor anti-pattern
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);

        // Get existing project
        const getRequest = store.get(project.id);

        getRequest.onsuccess = () => {
            const existingProject = getRequest.result;
            if (!existingProject) {
                // RACE CONDITION FIX: During sync, a project might not exist yet or have been replaced
                // Instead of throwing an error, log a warning and skip the update gracefully
                console.warn('[IDB] Project not found during update, skipping:', project.id);
                resolve(); // Resolve successfully to prevent errors from propagating
                return;
            }

            // Merge updates
            const updatedProject = { ...existingProject, ...project };
            const putRequest = store.put(updatedProject);

            putRequest.onsuccess = () => {
                console.log('[IDB] Project updated:', updatedProject.id);
                if (projectChangeCallback) {
                    projectChangeCallback(updatedProject);
                }
                resolve();
            };
            putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);
        const request = store.delete(projectId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Generate a unique task ID using cryptographically secure random values
 * @security Uses crypto.randomUUID() instead of Math.random() for unpredictability
 */
function generateTaskId(projectId: string): string {
    // SECURITY: Use crypto.randomUUID() for cryptographically secure random IDs
    // This prevents task ID prediction attacks
    return `${projectId}-${Date.now()}-${crypto.randomUUID()}`;
}

/**
 * Find a task by ID in a task tree
 */
function findTask(tasks: Task[], taskId: string): Task | null {
    for (const task of tasks) {
        if (task.id === taskId) return task;
        if (task.subtasks.length > 0) {
            const found = findTask(task.subtasks, taskId);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Find a task by ID across all groups in a project
 */
function findTaskInProject(groups: Group[], taskId: string): { group: Group; task: Task } | null {
    for (const group of groups) {
        const task = findTask(group.tasks, taskId);
        if (task) return { group, task };
    }
    return null;
}

/**
 * Remove a task from a task tree
 */
function removeTask(tasks: Task[], taskId: string): boolean {
    for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].id === taskId) {
            tasks.splice(i, 1);
            return true;
        }
        if (tasks[i].subtasks.length > 0) {
            if (removeTask(tasks[i].subtasks, taskId)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Add a task to a project within a specific group
 */
export async function addTask(
    projectId: string,
    groupId: string,
    content: string,
    status: TaskStatus = 'todo',
    dueDate?: string,
    parentId?: string,
    repeatFrequency?: RepeatFrequency,
    scheduledDate?: string
): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const group = project.groups.find(g => g.id === groupId);
    if (!group) throw new Error('Group not found');

    const newTask: Task = {
        id: generateTaskId(projectId),
        content,
        status,
        scheduledDate,
        dueDate,
        repeatFrequency,
        subtasks: [],
        parentId,
        lineNumber: 0, // Not used in IndexedDB mode
        rawLine: '', // Not used in IndexedDB mode
    };

    if (parentId) {
        // Add as subtask
        const parentTask = findTask(group.tasks, parentId);
        if (!parentTask) throw new Error('Parent task not found');

        newTask.parentContent = parentTask.content;
        parentTask.subtasks.push(newTask);
    } else {
        // Add as root task in the group
        group.tasks.push(newTask);
    }

    await updateProject(project);
}

/**
 * Update a task in a project
 */
export async function updateTask(
    projectId: string,
    taskId: string,
    updates: Partial<Pick<Task, 'content' | 'status' | 'scheduledDate' | 'dueDate' | 'repeatFrequency'>>
): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const result = findTaskInProject(project.groups, taskId);
    if (!result) throw new Error('Task not found');

    const task = result.task;
    // Apply updates
    if (updates.content !== undefined) task.content = updates.content;
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.scheduledDate !== undefined) task.scheduledDate = updates.scheduledDate;
    if (updates.dueDate !== undefined) task.dueDate = updates.dueDate;
    if (updates.repeatFrequency !== undefined) task.repeatFrequency = updates.repeatFrequency;

    await updateProject(project);
}

/**
 * Delete a task from a project
 */
export async function deleteTask(projectId: string, taskId: string): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const result = findTaskInProject(project.groups, taskId);
    if (!result) throw new Error('Task not found');

    const removed = removeTask(result.group.tasks, taskId);
    if (!removed) throw new Error('Failed to remove task');

    await updateProject(project);
}

/**
 * Calculate next due date for recurring tasks
 */
function calculateNextDueDate(currentDueDate: string, repeatFrequency: RepeatFrequency): string {
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

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Handle recurring task completion
 */
export async function handleRecurringTask(
    projectId: string,
    taskId: string
): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const result = findTaskInProject(project.groups, taskId);
    if (!result) throw new Error('Task not found');

    const task = result.task;
    const group = result.group;
    if (!task.repeatFrequency) throw new Error('Task is not recurring');

    // Mark current task as done
    task.status = 'done';

    // Calculate next scheduled date
    const nextScheduledDate = task.scheduledDate
        ? calculateNextDueDate(task.scheduledDate, task.repeatFrequency)
        : undefined;

    // Calculate next due date
    const nextDueDate = task.dueDate
        ? calculateNextDueDate(task.dueDate, task.repeatFrequency)
        : undefined;

    // Create new recurring task
    const newTask: Task = {
        id: generateTaskId(projectId),
        content: task.content,
        status: 'todo',
        scheduledDate: nextScheduledDate,
        dueDate: nextDueDate,
        repeatFrequency: task.repeatFrequency,
        subtasks: [],
        parentId: task.parentId,
        parentContent: task.parentContent,
        lineNumber: 0,
        rawLine: '',
    };

    // Add new task at the same level in the same group
    if (task.parentId) {
        const parentTask = findTask(group.tasks, task.parentId);
        if (parentTask) {
            parentTask.subtasks.push(newTask);
        }
    } else {
        group.tasks.push(newTask);
    }

    await updateProject(project);
}

/**
 * Reorder tasks within a group
 */
export async function reorderTasks(projectId: string, groupId: string, tasks: Task[]): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const group = project.groups.find(g => g.id === groupId);
    if (!group) throw new Error('Group not found');

    group.tasks = tasks;
    await updateProject(project);
}

/**
 * Add a new group to a project
 */
export async function addGroup(projectId: string, name: string): Promise<string> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const groupId = `${projectId}-${Date.now()}-${crypto.randomUUID()}`;
    const newGroup: Group = {
        id: groupId,
        name,
        tasks: [],
    };

    project.groups.push(newGroup);
    await updateProject(project);
    return groupId;
}

/**
 * Delete a group and all its tasks
 */
export async function deleteGroup(projectId: string, groupId: string): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const index = project.groups.findIndex(g => g.id === groupId);
    if (index === -1) throw new Error('Group not found');

    project.groups.splice(index, 1);
    await updateProject(project);
}

/**
 * Update a group name
 */
export async function updateGroup(projectId: string, groupId: string, name: string): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const group = project.groups.find(g => g.id === groupId);
    if (!group) throw new Error('Group not found');

    group.name = name;
    await updateProject(project);
}

/**
 * Move a task to a new parent task (same group)
 */
export async function moveTaskToParent(
    projectId: string,
    groupId: string,
    taskId: string,
    newParentId: string | null
): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const group = project.groups.find(g => g.id === groupId);
    if (!group) throw new Error('Group not found');

    // Find and remove task from its current location
    const findAndRemoveTask = (tasks: Task[]): Task | null => {
        for (let i = 0; i < tasks.length; i++) {
            if (tasks[i].id === taskId) {
                const removed = tasks.splice(i, 1)[0];
                return removed;
            }
            if (tasks[i].subtasks.length > 0) {
                const found = findAndRemoveTask(tasks[i].subtasks);
                if (found) return found;
            }
        }
        return null;
    };

    const movedTask = findAndRemoveTask(group.tasks);
    if (!movedTask) {
        throw new Error('Task not found');
    }

    // Update parent info
    if (newParentId) {
        const newParentTask = findTask(group.tasks, newParentId);
        if (!newParentTask) throw new Error('New parent task not found');

        movedTask.parentId = newParentId;
        movedTask.parentContent = newParentTask.content;
        newParentTask.subtasks.push(movedTask);
    } else {
        movedTask.parentId = undefined;
        movedTask.parentContent = undefined;
        group.tasks.push(movedTask);
    }

    await updateProject(project);
}

/**
 * Move a task to a different group
 */
export async function moveTaskToGroup(
    projectId: string,
    fromGroupId: string,
    toGroupId: string,
    taskId: string
): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const fromGroup = project.groups.find(g => g.id === fromGroupId);
    if (!fromGroup) throw new Error('From group not found');

    const toGroup = project.groups.find(g => g.id === toGroupId);
    if (!toGroup) throw new Error('To group not found');

    // Find and remove task from source group
    const findAndRemoveTask = (tasks: Task[]): Task | null => {
        for (let i = 0; i < tasks.length; i++) {
            if (tasks[i].id === taskId) {
                const removed = tasks.splice(i, 1)[0];
                return removed;
            }
            if (tasks[i].subtasks.length > 0) {
                const found = findAndRemoveTask(tasks[i].subtasks);
                if (found) return found;
            }
        }
        return null;
    };

    const movedTask = findAndRemoveTask(fromGroup.tasks);
    if (!movedTask) {
        throw new Error('Task not found in source group');
    }

    // Clear parent info when moving to different group (becomes root task)
    movedTask.parentId = undefined;
    movedTask.parentContent = undefined;

    toGroup.tasks.push(movedTask);
    await updateProject(project);
}

/**
 * Initialize with sample data (optional, for first-time users)
 */
export async function initializeSampleData(): Promise<void> {
    const projects = await getAllProjects();
    console.log('[IDB] Checking sample data initialization. Projects count:', projects.length);

    // Only initialize if database is empty
    if (projects.length > 0) return;

    const defaultGroup: Group = {
        id: 'getting-started-default-group',
        name: 'Default',
        tasks: [
            {
                id: 'getting-started-1',
                content: 'Welcome to Markdown Todo (IndexedDB Edition)!',
                status: 'todo',
                subtasks: [],
                lineNumber: 0,
                rawLine: '',
            },
            {
                id: 'getting-started-2',
                content: 'Create your first task',
                status: 'todo',
                dueDate: new Date().toISOString().split('T')[0],
                subtasks: [],
                lineNumber: 0,
                rawLine: '',
            },
            {
                id: 'getting-started-3',
                content: 'Try drag and drop to reorder tasks',
                status: 'todo',
                subtasks: [],
                lineNumber: 0,
                rawLine: '',
            },
        ],
    };

    const sampleProject: Omit<Project, 'path'> = {
        id: 'getting-started',
        title: 'Getting Started',
        groups: [defaultGroup],
    };

    await addProject(sampleProject);
}
