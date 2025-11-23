import path from 'path';
import {
  validateFilePath,
  validateLineNumber,
  withFileLock,
} from '@/lib/security';

describe('security (server-only functions)', () => {
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
