/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/projects/route';
import { POST } from '@/app/api/v1/projects/[projectId]/tasks/route';
import * as markdown from '@/lib/markdown';
import * as markdownUpdater from '@/lib/markdown-updater';
import * as security from '@/lib/security';
import * as monitoring from '@/lib/monitoring';
import * as Sentry from '@sentry/nextjs';

// Mock all dependencies
jest.mock('@/lib/markdown');
jest.mock('@/lib/markdown-updater');
jest.mock('@/lib/security');
jest.mock('@/lib/monitoring');
jest.mock('@sentry/nextjs');

// Mock auth module with proper ESM support
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
  getUserDataDir: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  apiLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  logError: jest.fn(),
}));

// Import auth after mocking
import * as auth from '@/lib/auth';

const mockMarkdown = markdown as jest.Mocked<typeof markdown>;
const mockMarkdownUpdater = markdownUpdater as jest.Mocked<typeof markdownUpdater>;
const mockSecurity = security as jest.Mocked<typeof security>;
const mockAuth = auth as jest.Mocked<typeof auth>;
const mockMonitoring = monitoring as jest.Mocked<typeof monitoring>;

describe('API /api/v1/projects', () => {
  const mockProjects = [
    {
      id: 'test',
      title: 'Test Project',
      tasks: [],
      path: '/data/user123/test.md',
    },
  ];

  const mockTransaction = {
    end: jest.fn(),
    startTime: Date.now(),
    context: {} as any,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock monitoring
    mockMonitoring.generateRequestId.mockReturnValue('req_123456_abc123');
    mockMonitoring.startApiTransaction.mockReturnValue(mockTransaction);

    // Mock auth
    mockAuth.auth.mockResolvedValue({
      user: { id: 'user123', email: 'test@example.com' },
    } as any);
    mockAuth.getUserDataDir.mockReturnValue('/data/user123');

    // Mock security validations - default to valid
    mockSecurity.validateProjectId.mockReturnValue({ valid: true });
    mockSecurity.validateTaskContent.mockReturnValue({ valid: true });
    mockSecurity.validateTaskStatus.mockReturnValue({ valid: true });
    mockSecurity.validateDueDate.mockReturnValue({ valid: true });
    mockSecurity.validateLineNumber.mockReturnValue({ valid: true });
    mockSecurity.validateFilePath.mockReturnValue(true);
    mockSecurity.sanitizeContent.mockImplementation((content) => content);
    mockSecurity.withFileLock.mockImplementation(async (_, fn) => fn());

    // Mock markdown
    mockMarkdown.getAllProjectsFromDir.mockResolvedValue(mockProjects);
  });

  describe('GET /api/v1/projects', () => {
    it('should return all projects for authenticated user', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockProjects);
      expect(mockMarkdown.getAllProjectsFromDir).toHaveBeenCalledWith('/data/user123');
    });

    it('should return 401 when user is not authenticated', async () => {
      mockAuth.auth.mockResolvedValue(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when user ID is missing', async () => {
      mockAuth.auth.mockResolvedValue({
        user: { email: 'test@example.com' },
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 500 on error', async () => {
      mockMarkdown.getAllProjectsFromDir.mockRejectedValue(new Error('Read error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to read projects');
    });

    it('should generate request ID', async () => {
      await GET();

      expect(mockMonitoring.generateRequestId).toHaveBeenCalled();
    });

    it('should start API transaction', async () => {
      await GET();

      expect(mockMonitoring.startApiTransaction).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/projects',
        requestId: 'req_123456_abc123',
      });
    });

    it('should end transaction with 200 on success', async () => {
      await GET();

      expect(mockTransaction.end).toHaveBeenCalledWith(200, {
        projectCount: mockProjects.length,
        userId: 'user123',
      });
    });

    it('should end transaction with 500 on error', async () => {
      mockMarkdown.getAllProjectsFromDir.mockRejectedValue(new Error('Read error'));

      await GET();

      expect(mockTransaction.end).toHaveBeenCalledWith(500);
    });

    it('should report error to Sentry', async () => {
      const error = new Error('Read error');
      mockMarkdown.getAllProjectsFromDir.mockRejectedValue(error);

      await GET();

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { requestId: 'req_123456_abc123' },
      });
    });

    it('should use user-specific data directory', async () => {
      mockAuth.auth.mockResolvedValue({
        user: { id: 'different-user', email: 'other@example.com' },
      } as any);
      mockAuth.getUserDataDir.mockReturnValue('/data/different-user');

      await GET();

      expect(mockMarkdown.getAllProjectsFromDir).toHaveBeenCalledWith('/data/different-user');
    });

    it('should return empty array when no projects', async () => {
      mockMarkdown.getAllProjectsFromDir.mockResolvedValue([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });

  describe('POST /api/v1/projects/[projectId]/tasks', () => {
    const createRequest = (body: any) =>
      new NextRequest('http://localhost/api/v1/projects/test/tasks', {
        method: 'POST',
        body: JSON.stringify(body),
      });

    const createContext = (projectId: string) => ({
      params: Promise.resolve({ projectId }),
    });

    it('should create a new task', async () => {
      const request = createRequest({
        content: 'New Task',
        status: 'todo',
      });

      const response = await POST(request, createContext('test'));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(mockProjects);
      expect(mockMarkdownUpdater.addTask).toHaveBeenCalled();
    });

    it('should validate project ID', async () => {
      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      await POST(request, createContext('test'));

      expect(mockSecurity.validateProjectId).toHaveBeenCalledWith('test');
    });

    it('should return 400 for invalid project ID', async () => {
      mockSecurity.validateProjectId.mockReturnValue({
        valid: false,
        error: 'Invalid project ID',
      });

      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      const response = await POST(request, createContext('invalid/../project'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid project ID');
    });

    it('should return 404 for non-existent project', async () => {
      mockMarkdown.getAllProjectsFromDir.mockResolvedValue([]);

      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      const response = await POST(request, createContext('nonexistent'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Project not found');
    });

    it('should validate task content', async () => {
      const request = createRequest({
        content: 'New Task',
        status: 'todo',
      });

      await POST(request, createContext('test'));

      expect(mockSecurity.validateTaskContent).toHaveBeenCalledWith('New Task');
    });

    it('should return 400 for invalid content', async () => {
      mockSecurity.validateTaskContent.mockReturnValue({
        valid: false,
        error: 'Content is required',
      });

      const request = createRequest({
        content: '',
        status: 'todo',
      });

      const response = await POST(request, createContext('test'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Content is required');
    });

    it('should validate task status', async () => {
      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      await POST(request, createContext('test'));

      expect(mockSecurity.validateTaskStatus).toHaveBeenCalledWith('todo');
    });

    it('should return 400 for invalid status', async () => {
      mockSecurity.validateTaskStatus.mockReturnValue({
        valid: false,
        error: 'Invalid status',
      });

      const request = createRequest({
        content: 'Task',
        status: 'invalid',
      });

      const response = await POST(request, createContext('test'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid status');
    });

    it('should validate due date when provided', async () => {
      const request = createRequest({
        content: 'Task',
        status: 'todo',
        dueDate: '2025-12-25',
      });

      await POST(request, createContext('test'));

      expect(mockSecurity.validateDueDate).toHaveBeenCalledWith('2025-12-25');
    });

    it('should return 400 for invalid due date', async () => {
      mockSecurity.validateDueDate.mockReturnValue({
        valid: false,
        error: 'Invalid date format',
      });

      const request = createRequest({
        content: 'Task',
        status: 'todo',
        dueDate: 'invalid',
      });

      const response = await POST(request, createContext('test'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid date format');
    });

    it('should validate parent line number when provided', async () => {
      const request = createRequest({
        content: 'Subtask',
        status: 'todo',
        parentLineNumber: 10,
      });

      await POST(request, createContext('test'));

      expect(mockSecurity.validateLineNumber).toHaveBeenCalledWith(10);
    });

    it('should return 400 for invalid parent line number', async () => {
      mockSecurity.validateLineNumber.mockReturnValue({
        valid: false,
        error: 'Invalid line number',
      });

      const request = createRequest({
        content: 'Subtask',
        status: 'todo',
        parentLineNumber: -1,
      });

      const response = await POST(request, createContext('test'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid line number');
    });

    it('should sanitize content before saving', async () => {
      const request = createRequest({
        content: 'Task #due:2025-12-25',
        status: 'todo',
      });

      await POST(request, createContext('test'));

      expect(mockSecurity.sanitizeContent).toHaveBeenCalledWith('Task #due:2025-12-25');
    });

    it('should use file locking', async () => {
      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      await POST(request, createContext('test'));

      expect(mockSecurity.withFileLock).toHaveBeenCalledWith(
        mockProjects[0].path,
        expect.any(Function)
      );
    });

    it('should call addTask with correct parameters', async () => {
      mockSecurity.sanitizeContent.mockReturnValue('Sanitized Task');

      const request = createRequest({
        content: 'Task',
        status: 'doing',
        dueDate: '2025-12-25',
        parentLineNumber: 5,
      });

      await POST(request, createContext('test'));

      expect(mockMarkdownUpdater.addTask).toHaveBeenCalledWith(
        mockProjects[0].path,
        'Sanitized Task',
        'doing',
        '2025-12-25',
        5
      );
    });

    it('should call addTask without optional parameters', async () => {
      const request = createRequest({
        content: 'Simple Task',
        status: 'todo',
      });

      await POST(request, createContext('test'));

      expect(mockMarkdownUpdater.addTask).toHaveBeenCalledWith(
        mockProjects[0].path,
        'Simple Task',
        'todo',
        undefined,
        undefined
      );
    });

    it('should return updated projects after adding task', async () => {
      const updatedProjects = [
        {
          ...mockProjects[0],
          tasks: [
            {
              id: 'test-1',
              content: 'New Task',
              status: 'todo',
              subtasks: [],
              rawLine: '- [ ] New Task',
              lineNumber: 1,
            },
          ],
        },
      ];

      mockMarkdown.getAllProjectsFromDir.mockResolvedValueOnce(mockProjects); // First call
      mockMarkdown.getAllProjectsFromDir.mockResolvedValueOnce(updatedProjects); // Second call

      const request = createRequest({
        content: 'New Task',
        status: 'todo',
      });

      const response = await POST(request, createContext('test'));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(updatedProjects);
    });

    it('should return 500 on error', async () => {
      mockMarkdownUpdater.addTask.mockImplementation(() => {
        throw new Error('Write error');
      });

      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      const response = await POST(request, createContext('test'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Write error');
    });

    it('should report error to Sentry', async () => {
      const error = new Error('Write error');
      mockMarkdownUpdater.addTask.mockImplementation(() => {
        throw error;
      });

      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      await POST(request, createContext('test'));

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { requestId: 'req_123456_abc123', projectId: 'test' },
      });
    });

    it('should log transaction completion', async () => {
      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      await POST(request, createContext('test'));

      // Transaction.end should be called whether success or failure
      expect(mockTransaction.end).toHaveBeenCalled();
      // Verify at least one call was made
      expect(mockTransaction.end.mock.calls.length).toBeGreaterThan(0);
    });

    it('should validate file path', async () => {
      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      await POST(request, createContext('test'));

      expect(mockSecurity.validateFilePath).toHaveBeenCalledWith(mockProjects[0].path);
    });

    it('should return 400 for invalid file path', async () => {
      mockSecurity.validateFilePath.mockReturnValue(false);

      const request = createRequest({
        content: 'Task',
        status: 'todo',
      });

      const response = await POST(request, createContext('test'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid file path');
    });
  });
});
