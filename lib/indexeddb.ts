import { Project, Task, TaskStatus, RepeatFrequency } from './types';

const DB_NAME = 'MarkdownTodoDB';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';

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

            // Create projects store
            if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
                const projectStore = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
                projectStore.createIndex('title', 'title', { unique: false });
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
export async function addProject(project: Omit<Project, 'path'>): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
        const store = transaction.objectStore(PROJECTS_STORE);

        // Add path as empty string for IndexedDB mode
        const projectWithPath: Project = { ...project, path: '' };
        const request = store.add(projectWithPath);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Update an existing project
 * @performance Fixed async Promise constructor anti-pattern
 */
export async function updateProject(project: Partial<Project> & { id: string }): Promise<void> {
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
                reject(new Error('Project not found'));
                return;
            }

            // Merge updates
            const updatedProject = { ...existingProject, ...project };
            const putRequest = store.put(updatedProject);

            putRequest.onsuccess = () => resolve();
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
 * Add a task to a project
 */
export async function addTask(
    projectId: string,
    content: string,
    status: TaskStatus = 'todo',
    dueDate?: string,
    parentId?: string,
    repeatFrequency?: RepeatFrequency
): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const newTask: Task = {
        id: generateTaskId(projectId),
        content,
        status,
        dueDate,
        repeatFrequency,
        subtasks: [],
        parentId,
        lineNumber: 0, // Not used in IndexedDB mode
        rawLine: '', // Not used in IndexedDB mode
    };

    if (parentId) {
        // Add as subtask
        const parentTask = findTask(project.tasks, parentId);
        if (!parentTask) throw new Error('Parent task not found');

        newTask.parentContent = parentTask.content;
        parentTask.subtasks.push(newTask);
    } else {
        // Add as root task
        project.tasks.push(newTask);
    }

    await updateProject(project);
}

/**
 * Update a task in a project
 */
export async function updateTask(
    projectId: string,
    taskId: string,
    updates: Partial<Pick<Task, 'content' | 'status' | 'dueDate' | 'repeatFrequency'>>
): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const task = findTask(project.tasks, taskId);
    if (!task) throw new Error('Task not found');

    // Apply updates
    if (updates.content !== undefined) task.content = updates.content;
    if (updates.status !== undefined) task.status = updates.status;
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

    const removed = removeTask(project.tasks, taskId);
    if (!removed) throw new Error('Task not found');

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

    const task = findTask(project.tasks, taskId);
    if (!task) throw new Error('Task not found');
    if (!task.repeatFrequency) throw new Error('Task is not recurring');

    // Mark current task as done
    task.status = 'done';

    // Calculate next due date
    const nextDueDate = task.dueDate
        ? calculateNextDueDate(task.dueDate, task.repeatFrequency)
        : undefined;

    // Create new recurring task
    const newTask: Task = {
        id: generateTaskId(projectId),
        content: task.content,
        status: 'todo',
        dueDate: nextDueDate,
        repeatFrequency: task.repeatFrequency,
        subtasks: [],
        parentId: task.parentId,
        parentContent: task.parentContent,
        lineNumber: 0,
        rawLine: '',
    };

    // Add new task at the same level
    if (task.parentId) {
        const parentTask = findTask(project.tasks, task.parentId);
        if (parentTask) {
            parentTask.subtasks.push(newTask);
        }
    } else {
        project.tasks.push(newTask);
    }

    await updateProject(project);
}

/**
 * Reorder tasks within a project
 */
export async function reorderTasks(projectId: string, tasks: Task[]): Promise<void> {
    const project = await getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    project.tasks = tasks;
    await updateProject(project);
}

/**
 * Initialize with sample data (optional, for first-time users)
 */
export async function initializeSampleData(): Promise<void> {
    const projects = await getAllProjects();

    // Only initialize if database is empty
    if (projects.length > 0) return;

    const sampleProject: Omit<Project, 'path'> = {
        id: 'getting-started',
        title: 'Getting Started',
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

    await addProject(sampleProject);
}
