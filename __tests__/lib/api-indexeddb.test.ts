/**
 * Unit Tests for lib/api-indexeddb.ts
 * Testing: API client, validation, markdown parsing, and task operations
 * Coverage: Branch coverage (C1), boundary values, exception handling, mocked dependencies
 */

import {
    ApiError,
    fetchProjects,
    createProject,
    updateProjectTitle,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
    fetchRawMarkdown,
    saveRawMarkdown,
    addGroup,
    updateGroup,
    deleteGroup,
    moveTaskToParent,
    moveTaskToGroup,
    getErrorMessage,
} from '@/lib/api-indexeddb';
import * as idb from '@/lib/indexeddb';
import * as validation from '@/lib/validation';
import { Project, Task, Group, TaskStatus } from '@/lib/types';

// Mock the idb module
jest.mock('@/lib/indexeddb');

// Mock the validation module
jest.mock('@/lib/validation');

describe('ApiError', () => {
    // Test: ApiError class construction
    it('should create ApiError with default status code', () => {
        const error = new ApiError('Test error');
        expect(error.message).toBe('Test error');
        expect(error.statusCode).toBe(500);
        expect(error.name).toBe('ApiError');
    });

    // Test: ApiError class construction with custom status code
    it('should create ApiError with custom status code', () => {
        const error = new ApiError('Not found', 404);
        expect(error.statusCode).toBe(404);
    });
});

describe('fetchProjects', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Fetch projects when database has data
    it('should return projects from IndexedDB when available', async () => {
        const mockProjects: Project[] = [
            {
                id: 'project1',
                title: 'Project 1',
                groups: [],
                path: '',
            },
        ];

        (idb.getAllProjects as jest.Mock).mockResolvedValue(mockProjects);

        const result = await fetchProjects();

        expect(result).toEqual(mockProjects);
        expect(idb.getAllProjects).toHaveBeenCalled();
        expect(idb.initializeSampleData).not.toHaveBeenCalled();
    });

    // Test: Initialize sample data when database is empty
    it('should initialize sample data when database is empty', async () => {
        const mockProjects: Project[] = [
            {
                id: 'getting-started',
                title: 'Getting Started',
                groups: [],
                path: '',
            },
        ];

        (idb.getAllProjects as jest.Mock)
            .mockResolvedValueOnce([]) // First call returns empty
            .mockResolvedValueOnce(mockProjects); // Second call after init

        (idb.initializeSampleData as jest.Mock).mockResolvedValue(undefined);

        const result = await fetchProjects();

        expect(idb.initializeSampleData).toHaveBeenCalled();
        expect(result).toEqual(mockProjects);
    });

    // Test: Handle IndexedDB error
    it('should throw ApiError when IndexedDB access fails', async () => {
        (idb.getAllProjects as jest.Mock).mockRejectedValue(
            new Error('IndexedDB error')
        );

        await expect(fetchProjects()).rejects.toThrow(ApiError);
        await expect(fetchProjects()).rejects.toMatchObject({
            statusCode: 500,
            message: 'Failed to load projects from IndexedDB',
        });
    });
});

describe('createProject', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Create project with valid title
    it('should create project with valid title', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateProjectId as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.getProjectById as jest.Mock).mockResolvedValue(null);
        (idb.addProject as jest.Mock).mockResolvedValue(undefined);

        const result = await createProject('My Project');

        expect(result.id).toBe('my-project');
        expect(result.title).toBe('My Project');
        expect(result.groups).toHaveLength(1);
        expect(result.groups[0].name).toBe('Default');
        expect(idb.addProject).toHaveBeenCalled();
    });

    // Test: Project title validation failure
    it('should throw ApiError when title validation fails', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: false,
            error: 'Invalid title',
        });

        await expect(createProject('invalid')).rejects.toThrow(ApiError);
        await expect(createProject('invalid')).rejects.toMatchObject({
            statusCode: 400,
        });
    });

    // Test: Project ID validation failure
    it('should throw ApiError when project ID validation fails', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateProjectId as jest.Mock).mockReturnValue({
            valid: false,
            error: 'Invalid ID',
        });

        await expect(createProject('Test')).rejects.toThrow(ApiError);
    });

    // Test: Slugify project title (uppercase to lowercase)
    it('should slugify project title correctly', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateProjectId as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.getProjectById as jest.Mock).mockResolvedValue(null);

        const result = await createProject('My Awesome Project');

        expect(result.id).toBe('my-awesome-project');
    });

    // Test: Slugify with special characters
    it('should handle special characters in title', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateProjectId as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.getProjectById as jest.Mock).mockResolvedValue(null);

        const result = await createProject('Test-Project_123');

        // The slugify function converts [^a-z0-9]+ to -, so underscore becomes hyphen
        expect(result.id).toBe('test-project-123');
    });

    // Test: Existing project error
    it('should throw error when project already exists', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateProjectId as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.getProjectById as jest.Mock).mockResolvedValue({
            id: 'test',
            title: 'Test',
            groups: [],
            path: '',
        });

        await expect(createProject('Test')).rejects.toThrow(ApiError);
        await expect(createProject('Test')).rejects.toMatchObject({
            statusCode: 400,
            message: 'A project with this name already exists',
        });
    });

    // Test: Untitled project when title becomes empty after slugify
    it('should use "untitled" when title becomes empty after slugify', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateProjectId as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.getProjectById as jest.Mock).mockResolvedValue(null);

        const result = await createProject('!!!');

        expect(result.id).toBe('untitled');
    });

    // Test: Handle IDB error during add
    it('should throw ApiError when addProject fails', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateProjectId as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.getProjectById as jest.Mock).mockResolvedValue(null);
        (idb.addProject as jest.Mock).mockRejectedValue(
            new Error('IDB error')
        );

        await expect(createProject('Test')).rejects.toThrow(ApiError);
        await expect(createProject('Test')).rejects.toMatchObject({
            statusCode: 500,
        });
    });
});

describe('updateProjectTitle', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Update project title successfully
    it('should update project title when valid', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.getProjectById as jest.Mock).mockResolvedValue({
            id: 'test',
            title: 'Old',
            groups: [],
            path: '',
        });

        await updateProjectTitle('test', 'New Title');

        expect(idb.updateProject).toHaveBeenCalledWith({
            id: 'test',
            title: 'New Title',
        });
    });

    // Test: Title validation failure
    it('should throw error when title validation fails', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: false,
            error: 'Invalid',
        });

        await expect(updateProjectTitle('test', 'invalid')).rejects.toThrow(
            ApiError
        );
    });

    // Test: Project not found
    it('should throw 404 when project not found', async () => {
        (validation.validateProjectTitle as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.getProjectById as jest.Mock).mockResolvedValue(null);

        await expect(updateProjectTitle('nonexistent', 'New')).rejects.toThrow(
            ApiError
        );
        await expect(
            updateProjectTitle('nonexistent', 'New')
        ).rejects.toMatchObject({
            statusCode: 404,
        });
    });
});

describe('addTask', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Add valid task
    it('should add task with valid content', async () => {
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateDueDate as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.addTask as jest.Mock).mockResolvedValue(undefined);
        (idb.getAllProjects as jest.Mock).mockResolvedValue([]);

        await addTask('project1', 'group1', 'Task content', 'todo');

        expect(idb.addTask).toHaveBeenCalledWith(
            'project1',
            'group1',
            'Task content',
            'todo',
            undefined,
            undefined,
            undefined,
            undefined
        );
    });

    // Test: Invalid task content
    it('should throw error when task content is invalid', async () => {
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: false,
            error: 'Invalid content',
        });

        await expect(
            addTask('project1', 'group1', 'bad', 'todo')
        ).rejects.toThrow(ApiError);
    });

    // Test: Invalid task status
    it('should throw error when task status is invalid', async () => {
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: false,
            error: 'Invalid status',
        });

        await expect(
            addTask('project1', 'group1', 'content', 'invalid' as TaskStatus)
        ).rejects.toThrow(ApiError);
    });

    // Test: Invalid due date
    it('should throw error when due date is invalid', async () => {
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateDueDate as jest.Mock).mockReturnValue({
            valid: false,
            error: 'Invalid date',
        });

        await expect(
            addTask('project1', 'group1', 'content', 'todo', 'invalid-date')
        ).rejects.toThrow(ApiError);
    });

    // Test: Invalid scheduled date
    it('should throw error when scheduled date is invalid', async () => {
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateDueDate as jest.Mock).mockImplementation((date?: string) => {
            // Fail validation for 'invalid-date'
            if (date === 'invalid-date') {
                return { valid: false, error: 'Invalid date' };
            }
            return { valid: true };
        });

        await expect(
            addTask(
                'project1',
                'group1',
                'content',
                'todo',
                undefined,
                undefined,
                undefined,
                undefined,
                'invalid-date'
            )
        ).rejects.toThrow(ApiError);
    });

    // Test: Add task with all optional parameters
    it('should add task with optional parameters', async () => {
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateDueDate as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.addTask as jest.Mock).mockResolvedValue(undefined);
        (idb.getAllProjects as jest.Mock).mockResolvedValue([]);

        await addTask(
            'project1',
            'group1',
            'content',
            'todo',
            '2025-12-31',
            undefined,
            'daily',
            undefined,
            '2025-12-25'
        );

        expect(idb.addTask).toHaveBeenCalledWith(
            'project1',
            'group1',
            'content',
            'todo',
            '2025-12-31',
            undefined,
            'daily',
            '2025-12-25'
        );
    });
});

describe('updateTask', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockProject: Project = {
        id: 'project1',
        title: 'Project 1',
        groups: [
            {
                id: 'group1',
                name: 'Group 1',
                tasks: [
                    {
                        id: 'task1',
                        content: 'Task 1',
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

    // Test: Missing taskId
    it('should throw error when taskId is missing', async () => {
        await expect(
            updateTask('project1', 1, { status: 'done' })
        ).rejects.toThrow(ApiError);
        await expect(
            updateTask('project1', 1, { status: 'done' })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'Task ID is required for IndexedDB mode',
        });
    });

    // Test: Invalid task content in update
    it('should throw error when updated content is invalid', async () => {
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: false,
            error: 'Invalid content',
        });

        await expect(
            updateTask('project1', 1, { content: 'bad' }, 'task1')
        ).rejects.toThrow(ApiError);
    });

    // Test: Invalid status in update
    it('should throw error when updated status is invalid', async () => {
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: false,
            error: 'Invalid status',
        });

        await expect(
            updateTask('project1', 1, { status: 'invalid' as TaskStatus }, 'task1')
        ).rejects.toThrow(ApiError);
    });

    // Test: Task not found
    it('should throw error when task not found', async () => {
        (idb.getProjectById as jest.Mock).mockResolvedValue(mockProject);
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: true,
        });

        await expect(
            updateTask('project1', 1, { status: 'done' }, 'nonexistent')
        ).rejects.toThrow(ApiError);
        await expect(
            updateTask('project1', 1, { status: 'done' }, 'nonexistent')
        ).rejects.toMatchObject({
            statusCode: 404,
            message: 'Task not found',
        });
    });

    // Test: Project not found
    it('should throw error when project not found', async () => {
        (idb.getProjectById as jest.Mock).mockResolvedValue(null);
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: true,
        });

        await expect(
            updateTask('nonexistent', 1, { status: 'done' }, 'task1')
        ).rejects.toThrow(ApiError);
        await expect(
            updateTask('nonexistent', 1, { status: 'done' }, 'task1')
        ).rejects.toMatchObject({
            statusCode: 404,
        });
    });

    // Test: Update task status to done with recurring task
    it('should handle recurring task when marked as done', async () => {
        const recurringProject: Project = {
            id: 'project1',
            title: 'Project 1',
            groups: [
                {
                    id: 'group1',
                    name: 'Group 1',
                    tasks: [
                        {
                            id: 'task1',
                            content: 'Recurring task',
                            status: 'todo',
                            repeatFrequency: 'daily',
                            dueDate: '2025-12-01',
                            subtasks: [],
                            rawLine: '',
                            lineNumber: 1,
                        },
                    ],
                },
            ],
            path: '',
        };

        (idb.getProjectById as jest.Mock).mockResolvedValue(recurringProject);
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.handleRecurringTask as jest.Mock).mockResolvedValue(undefined);

        await updateTask('project1', 1, { status: 'done' }, 'task1');

        expect(idb.handleRecurringTask).toHaveBeenCalledWith('project1', 'task1');
    });

    // Test: Update non-recurring task
    it('should update non-recurring task directly', async () => {
        (idb.getProjectById as jest.Mock).mockResolvedValue(mockProject);
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: true,
        });
        (validation.validateTaskStatus as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.updateTask as jest.Mock).mockResolvedValue(undefined);
        (idb.getAllProjects as jest.Mock).mockResolvedValue([]);

        await updateTask(
            'project1',
            1,
            { content: 'Updated', status: 'doing' },
            'task1'
        );

        expect(idb.updateTask).toHaveBeenCalledWith('project1', 'task1', {
            content: 'Updated',
            status: 'doing',
        });
    });
});

describe('deleteTask', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Missing taskId
    it('should throw error when taskId is missing', async () => {
        await expect(deleteTask('project1', 1)).rejects.toThrow(ApiError);
    });

    // Test: Delete task successfully
    it('should delete task when taskId is provided', async () => {
        (idb.deleteTask as jest.Mock).mockResolvedValue(undefined);
        (idb.getAllProjects as jest.Mock).mockResolvedValue([]);

        await deleteTask('project1', 1, 'task1');

        expect(idb.deleteTask).toHaveBeenCalledWith('project1', 'task1');
    });
});

describe('reorderTasks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Reorder tasks successfully
    it('should reorder tasks in a group', async () => {
        const tasks: Task[] = [
            {
                id: 'task1',
                content: 'Task 1',
                status: 'todo',
                subtasks: [],
                rawLine: '',
                lineNumber: 1,
            },
            {
                id: 'task2',
                content: 'Task 2',
                status: 'todo',
                subtasks: [],
                rawLine: '',
                lineNumber: 2,
            },
        ];

        (idb.reorderTasks as jest.Mock).mockResolvedValue(undefined);
        (idb.getAllProjects as jest.Mock).mockResolvedValue([]);

        await reorderTasks('project1', 'group1', tasks);

        expect(idb.reorderTasks).toHaveBeenCalledWith('project1', 'group1', tasks);
    });
});

describe('fetchRawMarkdown', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Fetch markdown for existing project
    it('should serialize project to markdown', async () => {
        const mockProject: Project = {
            id: 'project1',
            title: 'Test Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Default',
                    tasks: [
                        {
                            id: 'task1',
                            content: 'Task 1',
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

        (idb.getProjectById as jest.Mock).mockResolvedValue(mockProject);

        const result = await fetchRawMarkdown('project1');

        expect(result).toContain('# Test Project');
        expect(result).toContain('Task 1');
    });

    // Test: Project not found
    it('should throw 404 when project not found', async () => {
        (idb.getProjectById as jest.Mock).mockResolvedValue(null);

        await expect(fetchRawMarkdown('nonexistent')).rejects.toThrow(ApiError);
        await expect(fetchRawMarkdown('nonexistent')).rejects.toMatchObject({
            statusCode: 404,
        });
    });
});

describe('saveRawMarkdown', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Save valid markdown
    it('should parse and save markdown', async () => {
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.updateProject as jest.Mock).mockResolvedValue(undefined);

        const markdown = `# Test Project

- [ ] Task 1
`;

        await saveRawMarkdown('project1', markdown);

        expect(idb.updateProject).toHaveBeenCalled();
        const call = (idb.updateProject as jest.Mock).mock.calls[0][0];
        expect(call.id).toBe('project1');
        expect(call.title).toBe('Test Project');
    });

    // Test: Invalid task content in markdown
    it('should throw error when markdown contains invalid task', async () => {
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: false,
            error: 'Invalid task',
        });

        const markdown = `# Project

- [ ] <script>alert('xss')</script>
`;

        await expect(saveRawMarkdown('project1', markdown)).rejects.toThrow(
            ApiError
        );
    });
});

describe('Markdown parsing edge cases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (validation.validateTaskContent as jest.Mock).mockReturnValue({
            valid: true,
        });
        (idb.updateProject as jest.Mock).mockResolvedValue(undefined);
    });

    // Test: Parse markdown with due dates
    it('should parse due dates from markdown', async () => {
        const markdown = `# Project
- [ ] Task #due:2025-12-31
`;

        await saveRawMarkdown('project1', markdown);

        const call = (idb.updateProject as jest.Mock).mock.calls[0][0];
        expect(call.groups[0].tasks[0].dueDate).toBe('2025-12-31');
    });

    // Test: Parse markdown with scheduled dates
    it('should parse scheduled dates from markdown', async () => {
        const markdown = `# Project
- [ ] Task #do:2025-12-25
`;

        await saveRawMarkdown('project1', markdown);

        const call = (idb.updateProject as jest.Mock).mock.calls[0][0];
        expect(call.groups[0].tasks[0].scheduledDate).toBe('2025-12-25');
    });

    // Test: Parse markdown with repeat frequency
    it('should parse repeat frequency from markdown', async () => {
        const markdown = `# Project
- [ ] Task #repeat:daily
`;

        await saveRawMarkdown('project1', markdown);

        const call = (idb.updateProject as jest.Mock).mock.calls[0][0];
        expect(call.groups[0].tasks[0].repeatFrequency).toBe('daily');
    });

    // Test: Parse markdown with subtasks
    it('should parse subtasks from markdown', async () => {
        const markdown = `# Project
- [ ] Parent task
    - [ ] Subtask 1
    - [ ] Subtask 2
`;

        await saveRawMarkdown('project1', markdown);

        const call = (idb.updateProject as jest.Mock).mock.calls[0][0];
        const parentTask = call.groups[0].tasks[0];
        expect(parentTask.subtasks).toHaveLength(2);
    });

    // Test: Parse markdown with checked tasks
    it('should parse checked tasks as done', async () => {
        const markdown = `# Project
- [x] Completed task
- [ ] Incomplete task
`;

        await saveRawMarkdown('project1', markdown);

        const call = (idb.updateProject as jest.Mock).mock.calls[0][0];
        expect(call.groups[0].tasks[0].status).toBe('done');
        expect(call.groups[0].tasks[1].status).toBe('todo');
    });

    // Test: Parse markdown with multiple groups
    it('should parse multiple groups from markdown', async () => {
        const markdown = `# Project
### Todo
- [ ] Task 1
### Doing
- [ ] Task 2
`;

        await saveRawMarkdown('project1', markdown);

        const call = (idb.updateProject as jest.Mock).mock.calls[0][0];
        expect(call.groups).toHaveLength(2);
    });

    // Test: Nesting too deep
    it('should throw error when nesting exceeds MAX_TASK_NESTING_LEVEL', async () => {
        let markdown = '# Project\n- [ ] Root Task';
        // Create deeply nested structure that exceeds limit (10 levels)
        for (let i = 0; i < 12; i++) {
            const indent = '    '.repeat(i + 1);
            markdown += `\n${indent}- [ ] Nested Level ${i + 1}`;
        }

        // This should throw validation error due to exceeding MAX_TASK_NESTING_LEVEL
        (validation.validateTaskContent as jest.Mock).mockImplementation(
            (content: string) => {
                if (content.includes('exceeds')) {
                    return { valid: false, error: 'Max nesting exceeded' };
                }
                return { valid: true };
            }
        );

        await expect(saveRawMarkdown('project1', markdown)).rejects.toThrow(
            ApiError
        );
    });

    // Test: Empty markdown
    it('should handle empty markdown content', async () => {
        const markdown = '';

        await saveRawMarkdown('project1', markdown);

        const call = (idb.updateProject as jest.Mock).mock.calls[0][0];
        expect(call.id).toBe('project1');
        expect(call.groups).toHaveLength(1);
        expect(call.groups[0].tasks).toHaveLength(0);
    });

    // Test: Markdown with only title
    it('should handle markdown with only title', async () => {
        const markdown = '# My Project Title';

        await saveRawMarkdown('project1', markdown);

        const call = (idb.updateProject as jest.Mock).mock.calls[0][0];
        expect(call.title).toBe('My Project Title');
    });
});

describe('Markdown serialization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Serialize project with multiple groups
    it('should serialize project with multiple groups', async () => {
        const project: Project = {
            id: 'project1',
            title: 'Test Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Todo',
                    tasks: [
                        {
                            id: 'task1',
                            content: 'Task 1',
                            status: 'todo',
                            subtasks: [],
                            rawLine: '',
                            lineNumber: 1,
                        },
                    ],
                },
                {
                    id: 'group2',
                    name: 'Done',
                    tasks: [
                        {
                            id: 'task2',
                            content: 'Task 2',
                            status: 'done',
                            subtasks: [],
                            rawLine: '',
                            lineNumber: 2,
                        },
                    ],
                },
            ],
            path: '',
        };

        (idb.getProjectById as jest.Mock).mockResolvedValue(project);

        const result = await fetchRawMarkdown('project1');

        expect(result).toContain('### Todo');
        expect(result).toContain('### Done');
        expect(result).toContain('[x]');
    });

    // Test: Serialize with tags
    it('should serialize tasks with tags', async () => {
        const project: Project = {
            id: 'project1',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Default',
                    tasks: [
                        {
                            id: 'task1',
                            content: 'Task',
                            status: 'todo',
                            dueDate: '2025-12-31',
                            scheduledDate: '2025-12-25',
                            repeatFrequency: 'daily',
                            subtasks: [],
                            rawLine: '',
                            lineNumber: 1,
                        },
                    ],
                },
            ],
            path: '',
        };

        (idb.getProjectById as jest.Mock).mockResolvedValue(project);

        const result = await fetchRawMarkdown('project1');

        expect(result).toContain('#do:2025-12-25');
        expect(result).toContain('#due:2025-12-31');
        expect(result).toContain('#repeat:daily');
    });

    // Test: Serialize default group without header
    it('should not include header for single default group', async () => {
        const project: Project = {
            id: 'project1',
            title: 'Project',
            groups: [
                {
                    id: 'group1',
                    name: 'Default',
                    tasks: [
                        {
                            id: 'task1',
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

        (idb.getProjectById as jest.Mock).mockResolvedValue(project);

        const result = await fetchRawMarkdown('project1');

        expect(result).not.toContain('### Default');
    });
});

describe('Group operations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Add group
    it('should add group to project', async () => {
        (idb.addGroup as jest.Mock).mockResolvedValue('group-id-123');

        const result = await addGroup('project1', 'New Group');

        expect(result).toBe('group-id-123');
        expect(idb.addGroup).toHaveBeenCalledWith('project1', 'New Group');
    });

    // Test: Update group
    it('should update group name', async () => {
        (idb.updateGroup as jest.Mock).mockResolvedValue(undefined);

        await updateGroup('project1', 'group1', 'Updated Group');

        expect(idb.updateGroup).toHaveBeenCalledWith(
            'project1',
            'group1',
            'Updated Group'
        );
    });

    // Test: Delete group
    it('should delete group and return projects', async () => {
        (idb.deleteGroup as jest.Mock).mockResolvedValue(undefined);
        (idb.getAllProjects as jest.Mock).mockResolvedValue([]);

        await deleteGroup('project1', 'group1');

        expect(idb.deleteGroup).toHaveBeenCalledWith('project1', 'group1');
    });
});

describe('Task movement operations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: Move task to parent
    it('should move task to different parent', async () => {
        (idb.moveTaskToParent as jest.Mock).mockResolvedValue(undefined);
        (idb.getAllProjects as jest.Mock).mockResolvedValue([]);

        await moveTaskToParent('project1', 'group1', 'task1', 'new-parent');

        expect(idb.moveTaskToParent).toHaveBeenCalledWith(
            'project1',
            'group1',
            'task1',
            'new-parent'
        );
    });

    // Test: Move task to root (null parent)
    it('should move task to root when parent is null', async () => {
        (idb.moveTaskToParent as jest.Mock).mockResolvedValue(undefined);
        (idb.getAllProjects as jest.Mock).mockResolvedValue([]);

        await moveTaskToParent('project1', 'group1', 'task1', null);

        expect(idb.moveTaskToParent).toHaveBeenCalledWith(
            'project1',
            'group1',
            'task1',
            null
        );
    });

    // Test: Move task to different group
    it('should move task to different group', async () => {
        (idb.moveTaskToGroup as jest.Mock).mockResolvedValue(undefined);
        (idb.getAllProjects as jest.Mock).mockResolvedValue([]);

        await moveTaskToGroup('project1', 'group1', 'group2', 'task1');

        expect(idb.moveTaskToGroup).toHaveBeenCalledWith(
            'project1',
            'group1',
            'group2',
            'task1'
        );
    });
});

describe('getErrorMessage', () => {
    // Test: Get message from ApiError
    it('should return message from ApiError', () => {
        const error = new ApiError('Test error');
        const message = getErrorMessage(error);
        expect(message).toBe('Test error');
    });

    // Test: Get message from regular Error
    it('should return message from regular Error', () => {
        const error = new Error('Regular error');
        const message = getErrorMessage(error);
        expect(message).toBe('Regular error');
    });

    // Test: Get message from unknown error
    it('should return default message for unknown error', () => {
        const message = getErrorMessage('unknown');
        expect(message).toBe('An unexpected error occurred');
    });

    // Test: Get message from null
    it('should return default message for null', () => {
        const message = getErrorMessage(null);
        expect(message).toBe('An unexpected error occurred');
    });
});
