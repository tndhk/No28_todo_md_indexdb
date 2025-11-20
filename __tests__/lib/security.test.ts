import path from 'path';
import {
  validateFilePath,
  validateProjectId,
  validateTaskContent,
  validateTaskStatus,
  validateDueDate,
  validateLineNumber,
  sanitizeContent,
  withFileLock,
} from '@/lib/security';

describe('security', () => {
  describe('validateFilePath', () => {
    const dataDir = path.join(process.cwd(), 'data');

    it('should accept valid file paths within data directory', () => {
      const result = validateFilePath(path.join(dataDir, 'test.md'));
      expect(result).toBe(true);
    });

    it('should reject paths with path traversal', () => {
      const result = validateFilePath(path.join(dataDir, '..', '..', 'etc', 'passwd'));
      expect(result).toBe(false);
    });

    it('should reject paths outside data directory', () => {
      const result = validateFilePath('/etc/passwd');
      expect(result).toBe(false);
    });
  });

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

  describe('validateLineNumber', () => {
    it('should accept positive integers', () => {
      const result = validateLineNumber(1);
      expect(result.valid).toBe(true);
    });

    it('should accept large line numbers', () => {
      const result = validateLineNumber(10000);
      expect(result.valid).toBe(true);
    });

    it('should reject zero', () => {
      const result = validateLineNumber(0);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Line number must be positive');
    });

    it('should reject negative numbers', () => {
      const result = validateLineNumber(-1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Line number must be positive');
    });

    it('should reject non-integers', () => {
      const result = validateLineNumber(1.5);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Line number must be an integer');
    });

    it('should reject null/undefined', () => {
      const result = validateLineNumber(null as unknown as number);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Line number is required');
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

  describe('acquireFileLock and withFileLock', () => {
    it('should execute operation with file lock', async () => {
      const result = await withFileLock('/test.md', () => 'success');
      expect(result).toBe('success');
    });

    it('should execute async operation with file lock', async () => {
      const result = await withFileLock('/test.md', async () => {
        return Promise.resolve('async success');
      });
      expect(result).toBe('async success');
    });

    it('should handle concurrent operations sequentially', async () => {
      const order: number[] = [];

      const op1 = withFileLock('/test.md', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        order.push(1);
        return 1;
      });

      const op2 = withFileLock('/test.md', async () => {
        order.push(2);
        return 2;
      });

      await Promise.all([op1, op2]);

      // op1 should complete before op2 starts
      expect(order).toEqual([1, 2]);
    });

    it('should release lock after operation completes', async () => {
      await withFileLock('/test.md', () => 'first');
      const result = await withFileLock('/test.md', () => 'second');
      expect(result).toBe('second');
    });

    it('should release lock even if operation throws', async () => {
      try {
        await withFileLock('/test.md', () => {
          throw new Error('test error');
        });
      } catch {
        // expected
      }

      // Should be able to acquire lock again
      const result = await withFileLock('/test.md', () => 'after error');
      expect(result).toBe('after error');
    });
  });
});
