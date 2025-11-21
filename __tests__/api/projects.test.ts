/**
 * @jest-environment node
 */
import path from 'path';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/projects/route';
import * as markdown from '@/lib/markdown';
import * as markdownUpdater from '@/lib/markdown-updater';

// Mock the modules
jest.mock('@/lib/markdown');
jest.mock('@/lib/markdown-updater');

const mockMarkdown = markdown as jest.Mocked<typeof markdown>;
const mockMarkdownUpdater = markdownUpdater as jest.Mocked<typeof markdownUpdater>;

// Get the actual data directory path for test mocks
const dataDir = path.join(process.cwd(), 'data');

describe('API /api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return all projects', async () => {
      const mockProjects = [
        {
          id: 'test',
          title: 'Test Project',
          tasks: [],
          path: '/data/test.md',
        },
      ];
      mockMarkdown.getAllProjects.mockResolvedValue(mockProjects);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockProjects);
    });

    it('should return 500 on error', async () => {
      mockMarkdown.getAllProjects.mockRejectedValue(new Error('Read error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to read projects');
    });
  });

  describe('POST - add action', () => {
    const mockProject = {
      id: 'test',
      title: 'Test Project',
      tasks: [],
      path: path.join(dataDir, 'test.md'),
    };

    beforeEach(() => {
      mockMarkdown.getAllProjects.mockResolvedValue([mockProject]);
    });

    it('should add a new task', async () => {
      mockMarkdownUpdater.addTask.mockImplementation(() => {});

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          projectId: 'test',
          content: 'New Task',
          status: 'todo',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockMarkdownUpdater.addTask).toHaveBeenCalledWith(
        mockProject.path,
        'New Task',
        'todo',
        undefined,
        undefined,
        undefined
      );
    });

    it('should add task with due date', async () => {
      mockMarkdownUpdater.addTask.mockImplementation(() => {});

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          projectId: 'test',
          content: 'Task with date',
          status: 'todo',
          dueDate: '2025-12-25',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockMarkdownUpdater.addTask).toHaveBeenCalledWith(
        mockProject.path,
        'Task with date',
        'todo',
        '2025-12-25',
        undefined,
        undefined
      );
    });

    it('should reject invalid project ID', async () => {
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          projectId: '../../../etc/passwd',
          content: 'Task',
          status: 'todo',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('invalid characters');
    });

    it('should reject empty content', async () => {
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          projectId: 'test',
          content: '',
          status: 'todo',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should reject invalid status', async () => {
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          projectId: 'test',
          content: 'Task',
          status: 'invalid',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid status');
    });

    it('should reject invalid due date format', async () => {
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          projectId: 'test',
          content: 'Task',
          status: 'todo',
          dueDate: 'invalid-date',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('YYYY-MM-DD');
    });
  });

  describe('POST - updateTask action', () => {
    const mockProject = {
      id: 'test',
      title: 'Test Project',
      tasks: [
        {
          id: 'test-4',
          content: 'Task',
          status: 'todo' as const,
          subtasks: [],
          rawLine: '- [ ] Task',
          lineNumber: 4,
        },
      ],
      path: path.join(dataDir, 'test.md'),
    };

    beforeEach(() => {
      mockMarkdown.getAllProjects.mockResolvedValue([mockProject]);
    });

    it('should update task content', async () => {
      mockMarkdownUpdater.updateTask.mockImplementation(() => {});

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateTask',
          projectId: 'test',
          task: { id: 'test-4', lineNumber: 4 },
          updates: { content: 'Updated content' },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockMarkdownUpdater.updateTask).toHaveBeenCalled();
    });

    it('should update task status', async () => {
      mockMarkdownUpdater.updateTask.mockImplementation(() => {});

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateTask',
          projectId: 'test',
          task: { id: 'test-4', lineNumber: 4 },
          updates: { status: 'done' },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockMarkdownUpdater.updateTask).toHaveBeenCalled();
    });

    it('should reject missing task ID', async () => {
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'updateTask',
          projectId: 'test',
          task: {},
          updates: { content: 'New' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Task ID required');
    });
  });

  describe('POST - delete action', () => {
    const mockProject = {
      id: 'test',
      title: 'Test Project',
      tasks: [],
      path: path.join(dataDir, 'test.md'),
    };

    beforeEach(() => {
      mockMarkdown.getAllProjects.mockResolvedValue([mockProject]);
    });

    it('should delete task', async () => {
      mockMarkdownUpdater.deleteTask.mockImplementation(() => {});

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          projectId: 'test',
          task: { id: 'test-4', lineNumber: 4 },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockMarkdownUpdater.deleteTask).toHaveBeenCalledWith(mockProject.path, 4);
    });

    it('should reject missing task ID', async () => {
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          projectId: 'test',
          task: {},
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Task ID required');
    });
  });

  describe('POST - reorder action', () => {
    const mockProject = {
      id: 'test',
      title: 'Test Project',
      tasks: [],
      path: path.join(dataDir, 'test.md'),
    };

    beforeEach(() => {
      mockMarkdown.getAllProjects.mockResolvedValue([mockProject]);
    });

    it('should reorder tasks', async () => {
      mockMarkdownUpdater.rewriteMarkdown.mockImplementation(() => {});

      const newTasks = [
        {
          id: 'test-1',
          content: 'Task 1',
          status: 'todo',
          subtasks: [],
          rawLine: '',
          lineNumber: 1,
        },
      ];

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reorder',
          projectId: 'test',
          tasks: newTasks,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockMarkdownUpdater.rewriteMarkdown).toHaveBeenCalled();
    });

    it('should reject missing tasks array', async () => {
      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'reorder',
          projectId: 'test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Tasks array required');
    });
  });

  describe('POST - error handling', () => {
    it('should return 404 for non-existent project', async () => {
      mockMarkdown.getAllProjects.mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          projectId: 'nonexistent',
          content: 'Task',
          status: 'todo',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('should return 400 for invalid action', async () => {
      const mockProject = {
        id: 'test',
        title: 'Test Project',
        tasks: [],
        path: path.join(dataDir, 'test.md'),
      };
      mockMarkdown.getAllProjects.mockResolvedValue([mockProject]);

      const request = new NextRequest('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid',
          projectId: 'test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });
  });
});
