import { generateProjectId, sanitizeFilename } from '@/lib/utils';

describe('utils', () => {
  describe('generateProjectId', () => {
    it('should generate ID with slug and timestamp', () => {
      const title = 'My New Project';
      const id = generateProjectId(title);

      expect(id).toMatch(/^my-new-project-\d+$/);
    });

    it('should convert to lowercase', () => {
      const title = 'UPPERCASE PROJECT';
      const id = generateProjectId(title);

      expect(id).toMatch(/^uppercase-project-\d+$/);
    });

    it('should replace spaces with hyphens', () => {
      const title = 'project with spaces';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-with-spaces-\d+$/);
    });

    it('should remove special characters', () => {
      const title = 'Project!@#$%^&*()';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-\d+$/);
    });

    it('should handle multiple consecutive spaces', () => {
      const title = 'project    with    spaces';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-with-spaces-\d+$/);
    });

    it('should handle leading and trailing spaces', () => {
      const title = '  project  ';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-\d+$/);
    });

    it('should handle leading and trailing hyphens', () => {
      const title = '--project--';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-\d+$/);
    });

    it('should limit slug length to 50 characters', () => {
      const title = 'a'.repeat(100);
      const id = generateProjectId(title);

      const slug = id.split('-').slice(0, -1).join('-');
      expect(slug.length).toBeLessThanOrEqual(50);
    });

    it('should handle empty title', () => {
      const title = '';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-\d+$/);
    });

    it('should handle whitespace-only title', () => {
      const title = '   ';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-\d+$/);
    });

    it('should handle special-characters-only title', () => {
      const title = '!@#$%^&*()';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-\d+$/);
    });

    it('should generate unique IDs for same title', async () => {
      const title = 'Same Project';
      const id1 = generateProjectId(title);

      // Wait 2ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 2));

      const id2 = generateProjectId(title);

      expect(id1).not.toBe(id2);
      // Both should have same slug but different timestamp
      expect(id1).toMatch(/^same-project-\d+$/);
      expect(id2).toMatch(/^same-project-\d+$/);
    });

    it('should handle mixed alphanumeric characters', () => {
      const title = 'Project 123';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-123-\d+$/);
    });

    it('should handle unicode characters by removing them', () => {
      const title = 'Project 日本語';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-\d+$/);
    });

    it('should handle hyphens in title', () => {
      const title = 'my-existing-project';
      const id = generateProjectId(title);

      expect(id).toMatch(/^my-existing-project-\d+$/);
    });

    it('should replace multiple consecutive hyphens with single hyphen', () => {
      const title = 'project---with---hyphens';
      const id = generateProjectId(title);

      expect(id).toMatch(/^project-with-hyphens-\d+$/);
    });

    it('should have timestamp as last segment', () => {
      const title = 'Test Project';
      const id = generateProjectId(title);

      const segments = id.split('-');
      const lastSegment = segments[segments.length - 1];
      expect(Number(lastSegment)).toBeGreaterThan(0);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid filename characters', () => {
      const title = 'file<>:"/\\|?*name';
      const sanitized = sanitizeFilename(title);

      expect(sanitized).toBe('filename');
    });

    it('should replace spaces with underscores', () => {
      const title = 'file with spaces';
      const sanitized = sanitizeFilename(title);

      expect(sanitized).toBe('file_with_spaces');
    });

    it('should trim whitespace', () => {
      const title = '  filename  ';
      const sanitized = sanitizeFilename(title);

      expect(sanitized).toBe('filename');
    });

    it('should limit length to 100 characters', () => {
      const title = 'a'.repeat(200);
      const sanitized = sanitizeFilename(title);

      expect(sanitized.length).toBe(100);
    });

    it('should handle empty string', () => {
      const title = '';
      const sanitized = sanitizeFilename(title);

      expect(sanitized).toBe('');
    });

    it('should handle special characters', () => {
      const title = 'file@#$%^&()name';
      const sanitized = sanitizeFilename(title);

      expect(sanitized).toBe('file@#$%^&()name');
    });

    it('should handle multiple consecutive spaces', () => {
      const title = 'file    with    spaces';
      const sanitized = sanitizeFilename(title);

      expect(sanitized).toBe('file_with_spaces');
    });

    it('should preserve valid filename characters', () => {
      const title = 'valid-filename_123.txt';
      const sanitized = sanitizeFilename(title);

      expect(sanitized).toBe('valid-filename_123.txt');
    });

    it('should remove null characters', () => {
      const title = 'file\x00name';
      const sanitized = sanitizeFilename(title);

      expect(sanitized).toBe('filename');
    });

    it('should remove control characters', () => {
      const title = 'file\x01\x02name';
      const sanitized = sanitizeFilename(title);

      expect(sanitized).toBe('filename');
    });
  });
});
