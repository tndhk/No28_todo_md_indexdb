import { parseMarkdown } from '@/lib/markdown';

describe('parseMarkdown', () => {
  describe('title parsing', () => {
    it('should extract title from H1 header', () => {
      const content = '# My Project\n\n## Todo\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.title).toBe('My Project');
    });

    it('should use id as title when no H1 header exists', () => {
      const content = '## Todo\n- [ ] Task 1';
      const result = parseMarkdown('test-project', content, '/path/to/test.md');

      expect(result.title).toBe('test-project');
    });
  });

  describe('section parsing', () => {
    it('should detect Todo section', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].status).toBe('todo');
    });

    it('should detect Doing section', () => {
      const content = '# Project\n\n## Doing\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].status).toBe('doing');
    });

    it('should detect Done section', () => {
      const content = '# Project\n\n## Done\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].status).toBe('done');
    });

    it('should handle case-insensitive section names', () => {
      const content = '# Project\n\n## TODO\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].status).toBe('todo');
    });
  });

  describe('task parsing', () => {
    it('should parse unchecked tasks', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].content).toBe('Task 1');
      expect(result.tasks[0].status).toBe('todo');
    });

    it('should parse checked tasks as done', () => {
      const content = '# Project\n\n## Todo\n- [x] Completed Task';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].status).toBe('done');
    });

    it('should generate correct task ID', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      // Line number is 4 (H1=1, empty=2, H2=3, task=4)
      expect(result.tasks[0].id).toBe('test-4');
    });

    it('should store raw line content', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].rawLine).toBe('- [ ] Task 1');
    });

    it('should store line number (1-indexed)', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].lineNumber).toBe(4);
    });
  });

  describe('due date parsing', () => {
    it('should extract due date from task', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1 #due:2025-11-23';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].dueDate).toBe('2025-11-23');
    });

    it('should strip due date from content', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1 #due:2025-11-23';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].content).toBe('Task 1');
    });

    it('should handle tasks without due date', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].dueDate).toBeUndefined();
    });
  });

  describe('nested task parsing', () => {
    it('should parse nested subtasks', () => {
      const content = '# Project\n\n## Todo\n- [ ] Parent Task\n    - [ ] Child Task';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].subtasks).toHaveLength(1);
      expect(result.tasks[0].subtasks[0].content).toBe('Child Task');
    });

    it('should set parent ID for subtasks', () => {
      const content = '# Project\n\n## Todo\n- [ ] Parent Task\n    - [ ] Child Task';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].subtasks[0].parentId).toBe(result.tasks[0].id);
    });

    it('should set parent content for subtasks', () => {
      const content = '# Project\n\n## Todo\n- [ ] Parent Task\n    - [ ] Child Task';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].subtasks[0].parentContent).toBe('Parent Task');
    });

    it('should handle multiple levels of nesting', () => {
      const content = '# Project\n\n## Todo\n- [ ] Level 1\n    - [ ] Level 2\n        - [ ] Level 3';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].subtasks[0].subtasks[0].content).toBe('Level 3');
    });

    it('should handle siblings at same nesting level', () => {
      const content = '# Project\n\n## Todo\n- [ ] Parent\n    - [ ] Child 1\n    - [ ] Child 2';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].subtasks).toHaveLength(2);
      expect(result.tasks[0].subtasks[0].content).toBe('Child 1');
      expect(result.tasks[0].subtasks[1].content).toBe('Child 2');
    });
  });

  describe('project structure', () => {
    it('should return correct project structure', () => {
      const content = '# My Project\n\n## Todo\n- [ ] Task 1';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result).toEqual({
        id: 'test',
        title: 'My Project',
        tasks: expect.any(Array),
        path: '/path/to/test.md',
      });
    });

    it('should handle empty content', () => {
      const content = '';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks).toHaveLength(0);
      expect(result.title).toBe('test');
    });

    it('should handle multiple top-level tasks', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('should handle tasks with special characters', () => {
      const content = '# Project\n\n## Todo\n- [ ] Task with "quotes" & <brackets>';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks[0].content).toBe('Task with "quotes" & <brackets>');
    });

    it('should handle tasks across multiple sections', () => {
      const content = '# Project\n\n## Todo\n- [ ] Todo Task\n\n## Doing\n- [ ] Doing Task\n\n## Done\n- [x] Done Task';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks).toHaveLength(3);
      expect(result.tasks[0].status).toBe('todo');
      expect(result.tasks[1].status).toBe('doing');
      expect(result.tasks[2].status).toBe('done');
    });

    it('should ignore non-task content', () => {
      const content = '# Project\n\nSome description text\n\n## Todo\n- [ ] Task 1\n\nMore text here';
      const result = parseMarkdown('test', content, '/path/to/test.md');

      expect(result.tasks).toHaveLength(1);
    });
  });
});
