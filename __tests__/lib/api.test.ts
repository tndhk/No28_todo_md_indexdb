import {
  fetchProjects,
  addTask,
  updateTask,
  deleteTask,
  reorderTasks,
  fetchRawMarkdown,
  saveRawMarkdown,
  getErrorMessage,
  ApiError,
} from '@/lib/api';
import { validateProjectsResponse, ApiValidationError } from '@/lib/schemas';
import { Task } from '@/lib/types';

// Mock the schemas module
jest.mock('@/lib/schemas');

const mockValidateProjectsResponse = validateProjectsResponse as jest.MockedFunction<
  typeof validateProjectsResponse
>;

describe('lib/api', () => {
  const mockProjects = [
    {
      id: 'test',
      title: 'Test Project',
      tasks: [],
      path: '/data/test.md',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('ApiError', () => {
    it('should create an ApiError with message and status code', () => {
      const error = new ApiError('Test error', 404);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ApiError');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('fetchProjects', () => {
    it('should return validated projects on success', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      const result = await fetchProjects();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects');
      expect(mockValidateProjectsResponse).toHaveBeenCalledWith(mockProjects);
      expect(result).toEqual(mockProjects);
    });

    it('should throw ApiError on HTTP error with error message', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      } as Response);

      await expect(fetchProjects()).rejects.toThrow(ApiError);
      await expect(fetchProjects()).rejects.toThrow('Server error');
    });

    it('should throw ApiError with default message when json parsing fails', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as Response);

      await expect(fetchProjects()).rejects.toThrow('Unknown error');
    });

    it('should call validateProjectsResponse on success', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await fetchProjects();

      expect(mockValidateProjectsResponse).toHaveBeenCalledWith(mockProjects);
    });

    it('should handle network failures', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(fetchProjects()).rejects.toThrow('Network error');
    });
  });

  describe('addTask', () => {
    it('should add task with all fields', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      const result = await addTask('test', 'New Task', 'todo', '2025-12-25', 10);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'New Task',
          status: 'todo',
          dueDate: '2025-12-25',
          parentLineNumber: 10,
        }),
      });
      expect(result).toEqual(mockProjects);
    });

    it('should add task with minimal fields', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await addTask('test', 'Simple Task', 'doing');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Simple Task',
          status: 'doing',
          dueDate: undefined,
          parentLineNumber: undefined,
        }),
      });
    });

    it('should encode project ID in URL', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await addTask('project/with/slashes', 'Task', 'todo');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/projects/project%2Fwith%2Fslashes/tasks',
        expect.any(Object)
      );
    });

    it('should throw ApiError on failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid task content' }),
      } as Response);

      await expect(addTask('test', '', 'todo')).rejects.toThrow('Invalid task content');
    });

    it('should validate response schema', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await addTask('test', 'Task', 'todo');

      expect(mockValidateProjectsResponse).toHaveBeenCalledWith(mockProjects);
    });
  });

  describe('updateTask', () => {
    it('should update task content', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await updateTask('test', 5, { content: 'Updated content' });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/tasks/5', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Updated content' }),
      });
    });

    it('should update task status', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await updateTask('test', 5, { status: 'done' });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/tasks/5', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
    });

    it('should update task due date', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await updateTask('test', 5, { dueDate: '2025-12-31' });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/tasks/5', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: '2025-12-31' }),
      });
    });

    it('should update multiple fields at once', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await updateTask('test', 5, {
        content: 'New content',
        status: 'doing',
        dueDate: '2025-12-25',
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/tasks/5', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'New content',
          status: 'doing',
          dueDate: '2025-12-25',
        }),
      });
    });

    it('should throw ApiError on failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Task not found' }),
      } as Response);

      await expect(updateTask('test', 999, { content: 'New' })).rejects.toThrow(
        'Task not found'
      );
    });
  });

  describe('deleteTask', () => {
    it('should delete task by line number', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await deleteTask('test', 5);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/tasks/5', {
        method: 'DELETE',
      });
    });

    it('should encode project ID in URL', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await deleteTask('my-project', 10);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/my-project/tasks/10', {
        method: 'DELETE',
      });
    });

    it('should throw ApiError on failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Failed to delete' }),
      } as Response);

      await expect(deleteTask('test', 5)).rejects.toThrow('Failed to delete');
    });

    it('should validate response schema', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await deleteTask('test', 5);

      expect(mockValidateProjectsResponse).toHaveBeenCalledWith(mockProjects);
    });
  });

  describe('reorderTasks', () => {
    const mockTasks: Task[] = [
      {
        id: 'test-1',
        content: 'Task 1',
        status: 'todo',
        subtasks: [],
        rawLine: '- [ ] Task 1',
        lineNumber: 1,
      },
      {
        id: 'test-2',
        content: 'Task 2',
        status: 'todo',
        subtasks: [],
        rawLine: '- [ ] Task 2',
        lineNumber: 2,
      },
    ];

    it('should reorder tasks', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await reorderTasks('test', mockTasks);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: mockTasks }),
      });
    });

    it('should handle empty task array', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockProjects,
      } as Response);
      mockValidateProjectsResponse.mockReturnValue(mockProjects);

      await reorderTasks('test', []);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [] }),
      });
    });

    it('should throw ApiError on failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid task order' }),
      } as Response);

      await expect(reorderTasks('test', mockTasks)).rejects.toThrow('Invalid task order');
    });
  });

  describe('fetchRawMarkdown', () => {
    it('should fetch raw markdown content', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      const mockContent = '# Project\n\n## Todo\n- [ ] Task 1';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: mockContent }),
      } as Response);

      const result = await fetchRawMarkdown('test');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/raw');
      expect(result).toBe(mockContent);
    });

    it('should encode project ID in URL', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: '' }),
      } as Response);

      await fetchRawMarkdown('project/name');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/project%2Fname/raw');
    });

    it('should throw ApiError on failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Project not found' }),
      } as Response);

      await expect(fetchRawMarkdown('nonexistent')).rejects.toThrow('Project not found');
    });
  });

  describe('saveRawMarkdown', () => {
    it('should save raw markdown content', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const content = '# Updated Project\n\n## Todo\n- [ ] New Task';
      await saveRawMarkdown('test', content);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/raw', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    });

    it('should handle empty content', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await saveRawMarkdown('test', '');

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/projects/test/raw', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });
    });

    it('should throw ApiError on failure', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid content' }),
      } as Response);

      await expect(saveRawMarkdown('test', 'content')).rejects.toThrow('Invalid content');
    });

    it('should return void on success', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await saveRawMarkdown('test', 'content');

      expect(result).toBeUndefined();
    });
  });

  describe('getErrorMessage', () => {
    it('should return user-friendly message for ApiValidationError', () => {
      const validationError = new ApiValidationError({
        issues: [{ path: ['test'], message: 'Invalid' }],
      } as any);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const message = getErrorMessage(validationError);

      expect(message).toBe('Received unexpected data from server. Please try again.');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'API Validation Error:',
        validationError.issues
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return ApiError message', () => {
      const apiError = new ApiError('Custom API error', 500);

      const message = getErrorMessage(apiError);

      expect(message).toBe('Custom API error');
    });

    it('should return Error message', () => {
      const error = new Error('Generic error');

      const message = getErrorMessage(error);

      expect(message).toBe('Generic error');
    });

    it('should return default message for unknown error types', () => {
      const message = getErrorMessage('string error');

      expect(message).toBe('An unexpected error occurred');
    });

    it('should handle null/undefined errors', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
    });
  });
});
