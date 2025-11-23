import fs from 'fs';
import { updateTask, addTask, deleteTask, updateMarkdown, rewriteMarkdown } from '@/lib/markdown-updater';
import { Task, Project } from '@/lib/types';
import { resetConfig } from '@/lib/config';

// Mock fs module
jest.mock('fs');

// Mock security module to allow test file paths
jest.mock('@/lib/security', () => ({
  validateFilePath: jest.fn(() => true),
  validateFileExists: jest.fn(() => ({ valid: true })),
  validateProjectId: jest.fn(() => ({ valid: true })),
  validateProjectTitle: jest.fn(() => ({ valid: true })),
  validateTaskContent: jest.fn(() => ({ valid: true })),
  validateTaskStatus: jest.fn(() => ({ valid: true })),
  validateDueDate: jest.fn(() => ({ valid: true })),
  validateLineNumber: jest.fn(() => ({ valid: true })),
  sanitizeContent: jest.fn((content: string) => content),
  withFileLock: jest.fn((path, operation) => operation()),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('markdown-updater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetConfig();

    // Mock fs functions needed by config module
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);
    mockFs.accessSync.mockImplementation(() => {});
  });

  describe('updateTask', () => {
    it('should update task content', () => {
      const content = '# Project\n\n## Todo\n- [ ] Old Content';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      updateTask('/test.md', 4, { content: 'New Content' });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test.md',
        '# Project\n\n## Todo\n- [ ] New Content',
        'utf-8'
      );
    });

    it('should update task status to done', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      updateTask('/test.md', 4, { status: 'done' });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test.md',
        '# Project\n\n## Todo\n- [x] Task',
        'utf-8'
      );
    });

    it('should update task status to todo', () => {
      const content = '# Project\n\n## Todo\n- [x] Task';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      updateTask('/test.md', 4, { status: 'todo' });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test.md',
        '# Project\n\n## Todo\n- [ ] Task',
        'utf-8'
      );
    });

    it('should update task due date', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      updateTask('/test.md', 4, { dueDate: '2025-12-25' });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test.md',
        '# Project\n\n## Todo\n- [ ] Task #due:2025-12-25',
        'utf-8'
      );
    });

    it('should preserve indentation for nested tasks', () => {
      const content = '# Project\n\n## Todo\n- [ ] Parent\n    - [ ] Child';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      updateTask('/test.md', 5, { content: 'Updated Child' });

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test.md',
        '# Project\n\n## Todo\n- [ ] Parent\n    - [ ] Updated Child',
        'utf-8'
      );
    });

    it('should throw error for invalid line number', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task';
      mockFs.readFileSync.mockReturnValue(content);

      expect(() => updateTask('/test.md', 0, { content: 'New' })).toThrow('Invalid line number');
      expect(() => updateTask('/test.md', 100, { content: 'New' })).toThrow('Invalid line number');
    });

    it('should throw error for non-task line', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task';
      mockFs.readFileSync.mockReturnValue(content);

      expect(() => updateTask('/test.md', 1, { content: 'New' })).toThrow('Invalid task line');
    });
  });

  describe('addTask', () => {
    it('should add task to existing section', () => {
      const content = '# Project\n\n## Todo\n- [ ] Existing Task';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      addTask('/test.md', 'New Task', 'todo');

      const call = mockFs.writeFileSync.mock.calls[0];
      expect(call[1]).toContain('- [ ] New Task');
      expect(call[1]).toContain('- [ ] Existing Task');
    });

    it('should create section if it does not exist', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      addTask('/test.md', 'New Task', 'doing');

      const call = mockFs.writeFileSync.mock.calls[0];
      expect(call[1]).toContain('## Doing');
      expect(call[1]).toContain('- [ ] New Task');
    });

    it('should add task with due date', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      addTask('/test.md', 'Task with date', 'todo', '2025-12-25');

      const call = mockFs.writeFileSync.mock.calls[0];
      expect(call[1]).toContain('- [ ] Task with date #due:2025-12-25');
    });

    it('should add subtask with correct indentation', () => {
      const content = '# Project\n\n## Todo\n- [ ] Parent Task';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      addTask('/test.md', 'Child Task', 'todo', undefined, 4);

      const call = mockFs.writeFileSync.mock.calls[0];
      expect(call[1]).toContain('    - [ ] Child Task');
    });

    it('should add done task with checked checkbox', () => {
      const content = '# Project\n\n## Done\n- [x] Done Task';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      addTask('/test.md', 'Another Done Task', 'done');

      const call = mockFs.writeFileSync.mock.calls[0];
      expect(call[1]).toContain('- [x] Another Done Task');
    });
  });

  describe('deleteTask', () => {
    it('should delete single task', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1\n- [ ] Task 2';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      deleteTask('/test.md', 4);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test.md',
        '# Project\n\n## Todo\n- [ ] Task 2',
        'utf-8'
      );
    });

    it('should delete task with all its children', () => {
      const content = '# Project\n\n## Todo\n- [ ] Parent\n    - [ ] Child 1\n    - [ ] Child 2\n- [ ] Sibling';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      deleteTask('/test.md', 4);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test.md',
        '# Project\n\n## Todo\n- [ ] Sibling',
        'utf-8'
      );
    });

    it('should delete nested child without affecting siblings', () => {
      const content = '# Project\n\n## Todo\n- [ ] Parent\n    - [ ] Child 1\n    - [ ] Child 2';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      deleteTask('/test.md', 5);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test.md',
        '# Project\n\n## Todo\n- [ ] Parent\n    - [ ] Child 2',
        'utf-8'
      );
    });
  });

  describe('updateMarkdown', () => {
    it('should update multiple tasks by line number', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1\n- [ ] Task 2';
      mockFs.readFileSync.mockReturnValue(content);
      mockFs.writeFileSync.mockImplementation(() => {});

      const tasks: Task[] = [
        {
          id: 'test-4',
          content: 'Updated Task 1',
          status: 'done',
          subtasks: [],
          rawLine: '- [ ] Task 1',
          lineNumber: 4,
        },
        {
          id: 'test-5',
          content: 'Updated Task 2',
          status: 'todo',
          dueDate: '2025-12-25',
          subtasks: [],
          rawLine: '- [ ] Task 2',
          lineNumber: 5,
        },
      ];

      updateMarkdown('/test.md', tasks);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/test.md',
        '# Project\n\n## Todo\n- [x] Updated Task 1\n- [ ] Updated Task 2 #due:2025-12-25',
        'utf-8'
      );
    });
  });

  describe('rewriteMarkdown', () => {
    it('should rewrite entire file with new structure', () => {
      mockFs.writeFileSync.mockImplementation(() => {});

      const project: Project = {
        id: 'test',
        title: 'My Project',
        path: '/test.md',
        tasks: [
          {
            id: 'test-1',
            content: 'Todo Task',
            status: 'todo',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
          },
          {
            id: 'test-2',
            content: 'Done Task',
            status: 'done',
            subtasks: [],
            rawLine: '',
            lineNumber: 2,
          },
        ],
      };

      rewriteMarkdown('/test.md', project);

      const call = mockFs.writeFileSync.mock.calls[0];
      expect(call[1]).toContain('# My Project');
      expect(call[1]).toContain('## Todo');
      expect(call[1]).toContain('- [ ] Todo Task');
      expect(call[1]).toContain('## Done');
      expect(call[1]).toContain('- [x] Done Task');
    });

    it('should write nested tasks with correct indentation', () => {
      mockFs.writeFileSync.mockImplementation(() => {});

      const project: Project = {
        id: 'test',
        title: 'Project',
        path: '/test.md',
        tasks: [
          {
            id: 'test-1',
            content: 'Parent',
            status: 'todo',
            subtasks: [
              {
                id: 'test-2',
                content: 'Child',
                status: 'todo',
                subtasks: [],
                rawLine: '',
                lineNumber: 2,
              },
            ],
            rawLine: '',
            lineNumber: 1,
          },
        ],
      };

      rewriteMarkdown('/test.md', project);

      const call = mockFs.writeFileSync.mock.calls[0];
      expect(call[1]).toContain('- [ ] Parent');
      expect(call[1]).toContain('    - [ ] Child');
    });

    it('should only create sections that have tasks', () => {
      mockFs.writeFileSync.mockImplementation(() => {});

      const project: Project = {
        id: 'test',
        title: 'Project',
        path: '/test.md',
        tasks: [
          {
            id: 'test-1',
            content: 'Todo Task',
            status: 'todo',
            subtasks: [],
            rawLine: '',
            lineNumber: 1,
          },
        ],
      };

      rewriteMarkdown('/test.md', project);

      const call = mockFs.writeFileSync.mock.calls[0];
      expect(call[1]).toContain('## Todo');
      expect(call[1]).not.toContain('## Doing');
      expect(call[1]).not.toContain('## Done');
    });
  });
});
