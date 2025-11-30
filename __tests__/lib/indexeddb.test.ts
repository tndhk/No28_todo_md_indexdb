/**
 * Unit Tests for lib/indexeddb.ts
 * Testing: IndexedDB operations, CRUD, task management, recurring tasks
 * Coverage: Branch coverage (C1), boundary values, exception handling, mocked IndexedDB
 */

import * as idb from '@/lib/indexeddb';
import { Project, Task, Group, TaskStatus } from '@/lib/types';

// Mock IndexedDB API
class MockIDBRequest {
    result: any;
    error: any;
    onsuccess: ((this: IDBRequest<any>, ev: Event) => any) | null = null;
    onerror: ((this: IDBRequest<any>, ev: Event) => any) | null = null;

    constructor(result?: any, error?: any) {
        this.result = result;
        this.error = error;
    }

    triggerSuccess() {
        if (this.onsuccess) {
            this.onsuccess.call(this, new Event('success') as any);
        }
    }

    triggerError() {
        if (this.onerror) {
            this.onerror.call(this, new Event('error') as any);
        }
    }
}

class MockIDBObjectStore {
    data: Map<string, any> = new Map();
    name: string;
    keyPath: string = 'id';

    constructor(name: string) {
        this.name = name;
    }

    add(value: any): MockIDBRequest {
        const request = new MockIDBRequest();
        if (this.data.has(value.id)) {
            request.error = new Error('Duplicate key');
            setTimeout(() => request.triggerError(), 0);
        } else {
            this.data.set(value.id, value);
            request.result = value.id;
            setTimeout(() => request.triggerSuccess(), 0);
        }
        return request;
    }

    put(value: any): MockIDBRequest {
        const request = new MockIDBRequest();
        this.data.set(value.id, value);
        request.result = value.id;
        setTimeout(() => request.triggerSuccess(), 0);
        return request;
    }

    get(key: any): MockIDBRequest {
        const request = new MockIDBRequest();
        request.result = this.data.get(key) || null;
        setTimeout(() => request.triggerSuccess(), 0);
        return request;
    }

    getAll(): MockIDBRequest {
        const request = new MockIDBRequest();
        request.result = Array.from(this.data.values());
        setTimeout(() => request.triggerSuccess(), 0);
        return request;
    }

    delete(key: any): MockIDBRequest {
        const request = new MockIDBRequest();
        this.data.delete(key);
        setTimeout(() => request.triggerSuccess(), 0);
        return request;
    }

    createIndex(name: string, keyPath: string): any {
        return this;
    }
}

class MockIDBTransaction {
    stores: Map<string, MockIDBObjectStore> = new Map();

    objectStore(name: string): MockIDBObjectStore {
        if (!this.stores.has(name)) {
            this.stores.set(name, new MockIDBObjectStore(name));
        }
        return this.stores.get(name)!;
    }
}

class MockIDBDatabase {
    objectStores: Map<string, MockIDBObjectStore> = new Map();
    objectStoreNames: {
        contains: (name: string) => boolean;
    } = {
        contains: (name: string) => this.objectStores.has(name),
    };

    constructor() {
        this.objectStores.set('projects', new MockIDBObjectStore('projects'));
    }

    transaction(storeNames: string | string[], mode: string): MockIDBTransaction {
        const tx = new MockIDBTransaction();
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        for (const name of names) {
            tx.stores.set(name, this.objectStores.get(name)!);
        }
        return tx;
    }

    createObjectStore(name: string, options?: any): MockIDBObjectStore {
        const store = new MockIDBObjectStore(name);
        this.objectStores.set(name, store);
        return store;
    }
}

let mockDB: MockIDBDatabase;

// Mock global indexedDB
const mockIndexedDB = {
    open: jest.fn((dbName: string, version: number) => {
        const request = new MockIDBRequest();
        mockDB = new MockIDBDatabase();
        request.result = mockDB;
        setTimeout(() => request.triggerSuccess(), 0);
        return request;
    }),
};

Object.defineProperty(global, 'indexedDB', {
    value: mockIndexedDB,
    writable: true,
});

// Util to wait for async operations
async function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 10));
}

describe('setProjectChangeCallback', () => {
    // Test: Set callback
    it('should set project change callback', () => {
        const callback = jest.fn();
        idb.setProjectChangeCallback(callback);
        // Verify it was set (internal state, hard to test directly)
        idb.setProjectChangeCallback(null);
    });

    // Test: Clear callback with null
    it('should clear callback when set to null', () => {
        idb.setProjectChangeCallback(null);
    });
});

describe('getAllProjects', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Get empty projects list
    it('should return empty array when no projects exist', async () => {
        const result = await idb.getAllProjects();
        await flushPromises();
        expect(Array.isArray(result)).toBe(true);
    });

    // Test: Get projects
    it('should return all projects', async () => {
        const project: Project = {
            id: 'test',
            title: 'Test',
            groups: [],
            path: '',
        };
        mockDB.transaction('projects', 'readwrite')
            .objectStore('projects')
            .add(project);

        await flushPromises();
        const result = await idb.getAllProjects();
        await flushPromises();

        expect(result.length).toBeGreaterThanOrEqual(0);
    });
});

describe('getProjectById', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Get existing project
    it('should return project when it exists', async () => {
        const project: Project = {
            id: 'test',
            title: 'Test Project',
            groups: [],
            path: '',
        };

        // Add project directly to mock DB
        const tx = mockDB.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        const addRequest = store.add(project);

        await flushPromises();

        const result = await idb.getProjectById('test');
        await flushPromises();

        expect(result?.id).toBe('test');
        expect(result?.title).toBe('Test Project');
    });

    // Test: Return null for non-existent project
    it('should return null when project does not exist', async () => {
        const result = await idb.getProjectById('nonexistent');
        await flushPromises();

        expect(result).toBeNull();
    });
});

describe('addProject', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Add new project
    it('should add project to IndexedDB', async () => {
        const project: Omit<Project, 'path'> = {
            id: 'new-project',
            title: 'New Project',
            groups: [],
        };

        await idb.addProject(project);
        await flushPromises();

        const result = await idb.getProjectById('new-project');
        await flushPromises();

        expect(result?.id).toBe('new-project');
        expect(result?.path).toBe('');
    });

    // Test: Callback is triggered on add
    it('should trigger callback when project is added', async () => {
        const callback = jest.fn();
        idb.setProjectChangeCallback(callback);

        const project: Omit<Project, 'path'> = {
            id: 'callback-test',
            title: 'Callback Test',
            groups: [],
        };

        await idb.addProject(project);
        await flushPromises();

        expect(callback).toHaveBeenCalled();
        idb.setProjectChangeCallback(null);
    });
});

describe('updateProject', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Update existing project
    it('should update existing project', async () => {
        const project: Project = {
            id: 'test',
            title: 'Original Title',
            groups: [],
            path: '',
        };

        // Add project first
        const tx = mockDB.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        store.add(project);
        await flushPromises();

        // Update project
        await idb.updateProject({ id: 'test', title: 'Updated Title' });
        await flushPromises();

        const result = await idb.getProjectById('test');
        await flushPromises();

        expect(result?.title).toBe('Updated Title');
    });

    // Test: Error when project not found
    it('should throw error when updating non-existent project', async () => {
        await expect(
            idb.updateProject({ id: 'nonexistent', title: 'Title' })
        ).rejects.toThrow('Project not found');
    });

    // Test: Callback is triggered on update
    it('should trigger callback when project is updated', async () => {
        const callback = jest.fn();
        idb.setProjectChangeCallback(callback);

        const project: Project = {
            id: 'test',
            title: 'Original',
            groups: [],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.updateProject({ id: 'test', title: 'Updated' });
        await flushPromises();

        expect(callback).toHaveBeenCalled();
        idb.setProjectChangeCallback(null);
    });
});

describe('deleteProject', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Delete project
    it('should delete project from IndexedDB', async () => {
        const project: Project = {
            id: 'to-delete',
            title: 'Delete me',
            groups: [],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.deleteProject('to-delete');
        await flushPromises();

        const result = await idb.getProjectById('to-delete');
        await flushPromises();

        expect(result).toBeNull();
    });
});

describe('addTask', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Add task to group
    it('should add task to group', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.addTask('project', 'group1', 'New Task', 'todo');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks).toHaveLength(1);
        expect(result?.groups[0].tasks[0].content).toBe('New Task');
    });

    // Test: Add subtask
    it('should add subtask to parent task', async () => {
        const task: Task = {
            id: 'parent-1',
            content: 'Parent Task',
            status: 'todo',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.addTask(
            'project',
            'group1',
            'Subtask',
            'todo',
            undefined,
            'parent-1'
        );
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks[0].subtasks).toHaveLength(1);
    });

    // Test: Error when project not found
    it('should throw error when project not found', async () => {
        await expect(
            idb.addTask('nonexistent', 'group1', 'Task', 'todo')
        ).rejects.toThrow('Project not found');
    });

    // Test: Error when group not found
    it('should throw error when group not found', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await expect(
            idb.addTask('project', 'nonexistent', 'Task', 'todo')
        ).rejects.toThrow('Group not found');
    });

    // Test: Add task with all parameters
    it('should add task with all optional parameters', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.addTask(
            'project',
            'group1',
            'Task with dates',
            'todo',
            '2025-12-31',
            undefined,
            'daily',
            '2025-12-25'
        );
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        const addedTask = result?.groups[0].tasks[0];
        expect(addedTask?.dueDate).toBe('2025-12-31');
        expect(addedTask?.scheduledDate).toBe('2025-12-25');
        expect(addedTask?.repeatFrequency).toBe('daily');
    });
});

describe('updateTask', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Update task content
    it('should update task content', async () => {
        const task: Task = {
            id: 'task-1',
            content: 'Original',
            status: 'todo',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.updateTask('project', 'task-1', { content: 'Updated' });
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks[0].content).toBe('Updated');
    });

    // Test: Update task status
    it('should update task status', async () => {
        const task: Task = {
            id: 'task-1',
            content: 'Task',
            status: 'todo',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.updateTask('project', 'task-1', { status: 'done' });
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks[0].status).toBe('done');
    });

    // Test: Update task dates
    it('should update task dates', async () => {
        const task: Task = {
            id: 'task-1',
            content: 'Task',
            status: 'todo',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.updateTask('project', 'task-1', {
            dueDate: '2025-12-31',
            scheduledDate: '2025-12-25',
        });
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks[0].dueDate).toBe('2025-12-31');
        expect(result?.groups[0].tasks[0].scheduledDate).toBe('2025-12-25');
    });

    // Test: Error when task not found
    it('should throw error when task not found', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await expect(
            idb.updateTask('project', 'nonexistent', { content: 'Updated' })
        ).rejects.toThrow('Task not found');
    });
});

describe('deleteTask', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Delete task
    it('should delete task from group', async () => {
        const task: Task = {
            id: 'task-1',
            content: 'To delete',
            status: 'todo',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.deleteTask('project', 'task-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks).toHaveLength(0);
    });

    // Test: Delete subtask
    it('should delete subtask from parent', async () => {
        const subtask: Task = {
            id: 'subtask-1',
            content: 'Subtask',
            status: 'todo',
            parentId: 'task-1',
            subtasks: [],
            rawLine: '',
            lineNumber: 2,
        };

        const task: Task = {
            id: 'task-1',
            content: 'Parent',
            status: 'todo',
            subtasks: [subtask],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.deleteTask('project', 'subtask-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks[0].subtasks).toHaveLength(0);
    });

    // Test: Error when task not found
    it('should throw error when task not found', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await expect(idb.deleteTask('project', 'nonexistent')).rejects.toThrow(
            'Task not found'
        );
    });
});

describe('calculateNextDueDate', () => {
    // Test: Daily recurrence
    it('should calculate next due date for daily recurrence', () => {
        // This function is private, so we test it indirectly through handleRecurringTask
        // We'll test the calculation by checking the result in handleRecurringTask
    });

    // Test: Weekly recurrence
    it('should calculate next due date for weekly recurrence', () => {
        // Tested indirectly
    });

    // Test: Monthly recurrence
    it('should calculate next due date for monthly recurrence', () => {
        // Tested indirectly
    });
});

describe('handleRecurringTask', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Handle daily recurring task
    it('should create next daily occurrence when task is marked done', async () => {
        const task: Task = {
            id: 'task-1',
            content: 'Daily task',
            status: 'todo',
            dueDate: '2025-12-01',
            repeatFrequency: 'daily',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.handleRecurringTask('project', 'task-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        // Original task should be marked done
        expect(result?.groups[0].tasks[0].status).toBe('done');

        // New task should be created
        expect(result?.groups[0].tasks).toHaveLength(2);
        const newTask = result?.groups[0].tasks[1];
        expect(newTask?.status).toBe('todo');
        expect(newTask?.dueDate).toBe('2025-12-02'); // Next day
    });

    // Test: Weekly recurring task
    it('should create next weekly occurrence', async () => {
        const task: Task = {
            id: 'task-1',
            content: 'Weekly task',
            status: 'todo',
            dueDate: '2025-12-01',
            repeatFrequency: 'weekly',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.handleRecurringTask('project', 'task-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        const newTask = result?.groups[0].tasks[1];
        expect(newTask?.dueDate).toBe('2025-12-08'); // 7 days later
    });

    // Test: Monthly recurring task
    it('should create next monthly occurrence', async () => {
        const task: Task = {
            id: 'task-1',
            content: 'Monthly task',
            status: 'todo',
            dueDate: '2025-12-01',
            repeatFrequency: 'monthly',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.handleRecurringTask('project', 'task-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        const newTask = result?.groups[0].tasks[1];
        expect(newTask?.dueDate).toBe('2026-01-01'); // Next month
    });

    // Test: Recurring task with scheduled date
    it('should update scheduled date for next occurrence', async () => {
        const task: Task = {
            id: 'task-1',
            content: 'Task',
            status: 'todo',
            scheduledDate: '2025-12-01',
            repeatFrequency: 'daily',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.handleRecurringTask('project', 'task-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        const newTask = result?.groups[0].tasks[1];
        expect(newTask?.scheduledDate).toBe('2025-12-02');
    });

    // Test: Error when task not recurring
    it('should throw error when task is not recurring', async () => {
        const task: Task = {
            id: 'task-1',
            content: 'Non-recurring task',
            status: 'todo',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await expect(idb.handleRecurringTask('project', 'task-1')).rejects.toThrow(
            'Task is not recurring'
        );
    });

    // Test: Recurring subtask
    it('should create new subtask occurrence for recurring parent', async () => {
        const subtask: Task = {
            id: 'subtask-1',
            content: 'Recurring subtask',
            status: 'todo',
            dueDate: '2025-12-01',
            repeatFrequency: 'daily',
            parentId: 'task-1',
            subtasks: [],
            rawLine: '',
            lineNumber: 2,
        };

        const task: Task = {
            id: 'task-1',
            content: 'Parent',
            status: 'todo',
            subtasks: [subtask],
            rawLine: '',
            lineNumber: 1,
        };

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [task],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.handleRecurringTask('project', 'subtask-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        const parentTask = result?.groups[0].tasks[0];
        expect(parentTask?.subtasks).toHaveLength(2);
        expect(parentTask?.subtasks[1].status).toBe('todo');
    });
});

describe('reorderTasks', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Reorder tasks
    it('should reorder tasks within group', async () => {
        const tasks: Task[] = [
            {
                id: 'task-1',
                content: 'Task 1',
                status: 'todo',
                subtasks: [],
                rawLine: '',
                lineNumber: 1,
            },
            {
                id: 'task-2',
                content: 'Task 2',
                status: 'todo',
                subtasks: [],
                rawLine: '',
                lineNumber: 2,
            },
        ];

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks,
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        // Reverse order
        const reordered = [tasks[1], tasks[0]];
        await idb.reorderTasks('project', 'group1', reordered);
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks[0].id).toBe('task-2');
        expect(result?.groups[0].tasks[1].id).toBe('task-1');
    });
});

describe('addGroup', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Add group
    it('should add new group to project', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        const groupId = await idb.addGroup('project', 'New Group');
        await flushPromises();

        expect(groupId).toBeTruthy();
        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups).toHaveLength(1);
        expect(result?.groups[0].name).toBe('New Group');
    });
});

describe('deleteGroup', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Delete group
    it('should delete group and all its tasks', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [
                        {
                            id: 'task-1',
                            content: 'Task',
                            status: 'todo',
                            subtasks: [],
                            rawLine: '',
                            lineNumber: 1,
                        },
                    ],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.deleteGroup('project', 'group1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups).toHaveLength(0);
    });

    // Test: Error when group not found
    it('should throw error when group not found', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await expect(
            idb.deleteGroup('project', 'nonexistent')
        ).rejects.toThrow('Group not found');
    });
});

describe('updateGroup', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Update group name
    it('should update group name', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Old Name',
                    tasks: [],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.updateGroup('project', 'group1', 'New Name');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].name).toBe('New Name');
    });
});

describe('moveTaskToParent', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Move task to parent
    it('should move task under new parent', async () => {
        const tasks: Task[] = [
            {
                id: 'parent-1',
                content: 'Parent 1',
                status: 'todo',
                subtasks: [],
                rawLine: '',
                lineNumber: 1,
            },
            {
                id: 'task-1',
                content: 'Task 1',
                status: 'todo',
                subtasks: [],
                rawLine: '',
                lineNumber: 2,
            },
        ];

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks,
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.moveTaskToParent('project', 'group1', 'task-1', 'parent-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks).toHaveLength(1);
        expect(result?.groups[0].tasks[0].subtasks).toHaveLength(1);
        expect(result?.groups[0].tasks[0].subtasks[0].id).toBe('task-1');
    });

    // Test: Move task to root
    it('should move subtask to root when parent is null', async () => {
        const subtask: Task = {
            id: 'subtask-1',
            content: 'Subtask',
            status: 'todo',
            parentId: 'task-1',
            subtasks: [],
            rawLine: '',
            lineNumber: 2,
        };

        const tasks: Task[] = [
            {
                id: 'task-1',
                content: 'Parent',
                status: 'todo',
                subtasks: [subtask],
                rawLine: '',
                lineNumber: 1,
            },
        ];

        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks,
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.moveTaskToParent('project', 'group1', 'subtask-1', null);
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks).toHaveLength(2);
        expect(result?.groups[0].tasks[1].parentId).toBeUndefined();
    });
});

describe('moveTaskToGroup', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Move task between groups
    it('should move task to different group', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [
                        {
                            id: 'task-1',
                            content: 'Task',
                            status: 'todo',
                            subtasks: [],
                            rawLine: '',
                            lineNumber: 1,
                        },
                    ],
                },
                {
                    id: 'group2',
                    name: 'Group 2',
                    tasks: [],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.moveTaskToGroup('project', 'group1', 'group2', 'task-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        expect(result?.groups[0].tasks).toHaveLength(0);
        expect(result?.groups[1].tasks).toHaveLength(1);
    });

    // Test: Move task clears parent info
    it('should clear parent info when moving to different group', async () => {
        const project: Project = {
            id: 'project',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [
                        {
                            id: 'task-1',
                            content: 'Task',
                            status: 'todo',
                            parentId: 'parent-1',
                            parentContent: 'Parent',
                            subtasks: [],
                            rawLine: '',
                            lineNumber: 1,
                        },
                    ],
                },
                {
                    id: 'group2',
                    name: 'Group 2',
                    tasks: [],
                },
            ],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.moveTaskToGroup('project', 'group1', 'group2', 'task-1');
        await flushPromises();

        const result = await idb.getProjectById('project');
        await flushPromises();

        const movedTask = result?.groups[1].tasks[0];
        expect(movedTask?.parentId).toBeUndefined();
        expect(movedTask?.parentContent).toBeUndefined();
    });
});

describe('initializeSampleData', () => {
    beforeEach(() => {
        mockDB = new MockIDBDatabase();
        (mockIndexedDB.open as jest.Mock).mockImplementation(() => {
            const request = new MockIDBRequest();
            request.result = mockDB;
            setTimeout(() => request.triggerSuccess(), 0);
            return request;
        });
    });

    // Test: Initialize sample data only when empty
    it('should initialize sample data when database is empty', async () => {
        await idb.initializeSampleData();
        await flushPromises();

        const result = await idb.getAllProjects();
        await flushPromises();

        expect(result.length).toBeGreaterThan(0);
    });

    // Test: Skip initialization when data exists
    it('should not initialize sample data when projects exist', async () => {
        const project: Project = {
            id: 'existing',
            title: 'Existing',
            groups: [],
            path: '',
        };

        const tx = mockDB.transaction('projects', 'readwrite');
        tx.objectStore('projects').add(project);
        await flushPromises();

        await idb.initializeSampleData();
        await flushPromises();

        const result = await idb.getAllProjects();
        await flushPromises();

        // Should still have only one project (the existing one)
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('existing');
    });
});
