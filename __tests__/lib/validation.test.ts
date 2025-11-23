import {
  validateProjectId,
  validateProjectTitle,
  validateTaskContent,
  validateTaskStatus,
  validateDueDate,
  sanitizeContent,
} from '@/lib/validation';

describe('validation', () => {
  describe('validateProjectId', () => {
    it('should accept valid alphanumeric project IDs', () => {
      const result = validateProjectId('my-project-123');
      expect(result.valid).toBe(true);
    });

    it('should accept project IDs with underscores', () => {
      const result = validateProjectId('my_project');
      expect(result.valid).toBe(true);
    });

    it('should reject empty project ID', () => {
      const result = validateProjectId('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Project ID is required');
    });

    it('should reject project ID with invalid characters', () => {
      const result = validateProjectId('project/with/slashes');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Project ID contains invalid characters');
    });

    it('should reject project ID with spaces', () => {
      const result = validateProjectId('project with spaces');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Project ID contains invalid characters');
    });

    it('should reject overly long project IDs', () => {
      const result = validateProjectId('a'.repeat(101));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Project ID is too long');
    });

    it('should accept project ID at max length', () => {
      const result = validateProjectId('a'.repeat(100));
      expect(result.valid).toBe(true);
    });
  });

  describe('validateProjectTitle', () => {
    it('should accept valid project title', () => {
      const result = validateProjectTitle('My New Project');
      expect(result.valid).toBe(true);
    });

    it('should reject empty title', () => {
      const result = validateProjectTitle('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Project title is required');
    });

    it('should reject whitespace-only title', () => {
      const result = validateProjectTitle('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Project title cannot be empty');
    });

    it('should reject title that is too long', () => {
      const result = validateProjectTitle('a'.repeat(101));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Project title is too long (max 100 characters)');
    });

    it('should accept title at max length', () => {
      const result = validateProjectTitle('a'.repeat(100));
      expect(result.valid).toBe(true);
    });

    it('should accept title with special characters', () => {
      const result = validateProjectTitle('Project: #1 (v2.0)');
      expect(result.valid).toBe(true);
    });

    it('should accept title with unicode characters', () => {
      const result = validateProjectTitle('プロジェクト名');
      expect(result.valid).toBe(true);
    });

    it('should reject null title', () => {
      const result = validateProjectTitle(null as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Project title is required');
    });

    it('should reject non-string title', () => {
      const result = validateProjectTitle(123 as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Project title is required');
    });
  });

  describe('validateTaskContent', () => {
    it('should accept valid task content', () => {
      const result = validateTaskContent('Buy groceries');
      expect(result.valid).toBe(true);
    });

    it('should reject empty content', () => {
      const result = validateTaskContent('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Task content is required');
    });

    it('should reject whitespace-only content', () => {
      const result = validateTaskContent('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Task content cannot be empty');
    });

    it('should reject content that is too long', () => {
      const result = validateTaskContent('a'.repeat(501));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Task content is too long (max 500 characters)');
    });

    it('should accept content at max length', () => {
      const result = validateTaskContent('a'.repeat(500));
      expect(result.valid).toBe(true);
    });

    it('should reject content with multiple due tags', () => {
      const result = validateTaskContent('Task #due:2025-01-01 and #due:2025-02-02');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Task content cannot contain multiple #due: tags');
    });

    it('should accept content with single due tag', () => {
      const result = validateTaskContent('Task #due:2025-01-01');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateTaskStatus', () => {
    it('should accept valid status: todo', () => {
      const result = validateTaskStatus('todo');
      expect(result.valid).toBe(true);
    });

    it('should accept valid status: doing', () => {
      const result = validateTaskStatus('doing');
      expect(result.valid).toBe(true);
    });

    it('should accept valid status: done', () => {
      const result = validateTaskStatus('done');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = validateTaskStatus('invalid');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid status');
    });

    it('should reject empty status', () => {
      const result = validateTaskStatus('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Status is required');
    });
  });

  describe('validateDueDate', () => {
    it('should accept valid date format', () => {
      const result = validateDueDate('2025-12-25');
      expect(result.valid).toBe(true);
    });

    it('should accept undefined due date (optional)', () => {
      const result = validateDueDate(undefined);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = validateDueDate('25-12-2025');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Due date must be in YYYY-MM-DD format');
    });

    it('should reject invalid date values', () => {
      const result = validateDueDate('2025-13-45');
      expect(result.valid).toBe(false);
    });

    it('should reject non-string due date', () => {
      const result = validateDueDate(12345 as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Due date must be a string');
    });
  });

  describe('sanitizeContent', () => {
    it('should trim whitespace', () => {
      const result = sanitizeContent('  task content  ');
      expect(result).toBe('task content');
    });

    it('should remove due date tags', () => {
      const result = sanitizeContent('task #due:2025-01-01');
      expect(result).toBe('task');
    });

    it('should remove multiple due date tags', () => {
      const result = sanitizeContent('task #due:2025-01-01 text #due:2025-02-02');
      expect(result).toBe('task  text');
    });

    it('should handle content without due date tags', () => {
      const result = sanitizeContent('simple task');
      expect(result).toBe('simple task');
    });
  });
});
