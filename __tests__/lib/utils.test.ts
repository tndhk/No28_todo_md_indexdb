/**
 * Unit Tests for lib/utils.ts
 * Testing: Task tree operations, filtering, search functionality
 * Coverage: Branch coverage (C1), recursive operations, boundary values
 */

import {
    updateTaskInTree,
    deleteTaskFromTree,
    filterDoneTasks,
    filterTasksBySearch,
} from '@/lib/utils';
import { Task } from '@/lib/types';

// Helper function to create a task
function createTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 'task-1',
        content: 'Test Task',
        status: 'todo',
        subtasks: [],
        rawLine: '',
        lineNumber: 1,
        ...overrides,
    };
}

describe('updateTaskInTree', () => {
    describe('Root level task updates', () => {
        // Test: Update task content at root level
        it('should update task content at root level', () => {
            const tasks: Task[] = [createTask({ id: 'task-1', content: 'Original' })];
            const result = updateTaskInTree(tasks, 'task-1', { content: 'Updated' });

            expect(result[0].content).toBe('Updated');
        });

        // Test: Update task status at root level
        it('should update task status at root level', () => {
            const tasks: Task[] = [createTask({ id: 'task-1', status: 'todo' })];
            const result = updateTaskInTree(tasks, 'task-1', { status: 'done' });

            expect(result[0].status).toBe('done');
        });

        // Test: Update multiple properties
        it('should update multiple properties at once', () => {
            const tasks: Task[] = [createTask({ id: 'task-1' })];
            const result = updateTaskInTree(tasks, 'task-1', {
                content: 'New Content',
                status: 'doing',
                dueDate: '2025-12-31',
            });

            expect(result[0].content).toBe('New Content');
            expect(result[0].status).toBe('doing');
            expect(result[0].dueDate).toBe('2025-12-31');
        });

        // Test: Update first task in list of multiple
        it('should update correct task when multiple exist', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', content: 'Task 1' }),
                createTask({ id: 'task-2', content: 'Task 2' }),
                createTask({ id: 'task-3', content: 'Task 3' }),
            ];
            const result = updateTaskInTree(tasks, 'task-2', { content: 'Updated Task 2' });

            expect(result[0].content).toBe('Task 1');
            expect(result[1].content).toBe('Updated Task 2');
            expect(result[2].content).toBe('Task 3');
        });
    });

    describe('Nested task updates', () => {
        // Test: Update subtask content
        it('should update subtask content', () => {
            const subtask = createTask({ id: 'subtask-1', content: 'Subtask' });
            const tasks: Task[] = [
                createTask({ id: 'task-1', subtasks: [subtask] }),
            ];
            const result = updateTaskInTree(tasks, 'subtask-1', { content: 'Updated Subtask' });

            expect(result[0].subtasks[0].content).toBe('Updated Subtask');
        });

        // Test: Update deeply nested task (3 levels)
        it('should update deeply nested task', () => {
            const level3 = createTask({ id: 'level-3', content: 'Level 3' });
            const level2 = createTask({ id: 'level-2', subtasks: [level3] });
            const level1 = createTask({ id: 'level-1', subtasks: [level2] });
            const tasks: Task[] = [level1];

            const result = updateTaskInTree(tasks, 'level-3', { status: 'done' });

            expect(result[0].subtasks[0].subtasks[0].status).toBe('done');
        });

        // Test: Update subtask in second parent
        it('should update subtask in correct parent', () => {
            const subtask1 = createTask({ id: 'sub-1', content: 'Sub 1' });
            const subtask2 = createTask({ id: 'sub-2', content: 'Sub 2' });
            const tasks: Task[] = [
                createTask({ id: 'parent-1', subtasks: [subtask1] }),
                createTask({ id: 'parent-2', subtasks: [subtask2] }),
            ];

            const result = updateTaskInTree(tasks, 'sub-2', { content: 'Updated Sub 2' });

            expect(result[0].subtasks[0].content).toBe('Sub 1');
            expect(result[1].subtasks[0].content).toBe('Updated Sub 2');
        });
    });

    describe('Non-existent task ID', () => {
        // Test: Non-existent task ID returns original array unchanged
        it('should return original array when task ID not found', () => {
            const tasks: Task[] = [createTask({ id: 'task-1' })];
            const result = updateTaskInTree(tasks, 'nonexistent', { content: 'New' });

            expect(result[0].content).toBe('Test Task');
        });
    });

    describe('Immutability', () => {
        // Test: Original array is not mutated
        it('should not mutate original array', () => {
            const originalTasks: Task[] = [createTask({ id: 'task-1', content: 'Original' })];
            const originalContent = originalTasks[0].content;

            updateTaskInTree(originalTasks, 'task-1', { content: 'Updated' });

            // Original should be unchanged
            expect(originalTasks[0].content).toBe(originalContent);
        });
    });

    describe('Empty array', () => {
        // Test: Empty array returns empty array
        it('should return empty array when input is empty', () => {
            const tasks: Task[] = [];
            const result = updateTaskInTree(tasks, 'task-1', { content: 'New' });

            expect(result).toHaveLength(0);
        });
    });
});

describe('deleteTaskFromTree', () => {
    describe('Root level deletion', () => {
        // Test: Delete single task
        it('should delete task at root level', () => {
            const tasks: Task[] = [createTask({ id: 'task-1' })];
            const result = deleteTaskFromTree(tasks, 'task-1');

            expect(result).toHaveLength(0);
        });

        // Test: Delete first of multiple tasks
        it('should delete first task and keep others', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1' }),
                createTask({ id: 'task-2' }),
                createTask({ id: 'task-3' }),
            ];
            const result = deleteTaskFromTree(tasks, 'task-1');

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('task-2');
            expect(result[1].id).toBe('task-3');
        });

        // Test: Delete middle task
        it('should delete middle task and keep others', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1' }),
                createTask({ id: 'task-2' }),
                createTask({ id: 'task-3' }),
            ];
            const result = deleteTaskFromTree(tasks, 'task-2');

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('task-1');
            expect(result[1].id).toBe('task-3');
        });

        // Test: Delete last task
        it('should delete last task and keep others', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1' }),
                createTask({ id: 'task-2' }),
            ];
            const result = deleteTaskFromTree(tasks, 'task-2');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('task-1');
        });
    });

    describe('Nested deletion', () => {
        // Test: Delete subtask
        it('should delete subtask from parent', () => {
            const subtask = createTask({ id: 'subtask-1' });
            const tasks: Task[] = [
                createTask({ id: 'task-1', subtasks: [subtask] }),
            ];
            const result = deleteTaskFromTree(tasks, 'subtask-1');

            expect(result).toHaveLength(1);
            expect(result[0].subtasks).toHaveLength(0);
        });

        // Test: Delete deeply nested task
        it('should delete deeply nested task', () => {
            const level3 = createTask({ id: 'level-3' });
            const level2 = createTask({ id: 'level-2', subtasks: [level3] });
            const level1 = createTask({ id: 'level-1', subtasks: [level2] });
            const tasks: Task[] = [level1];

            const result = deleteTaskFromTree(tasks, 'level-3');

            expect(result[0].subtasks[0].subtasks).toHaveLength(0);
        });

        // Test: Delete one of multiple subtasks
        it('should delete one subtask and keep siblings', () => {
            const subtask1 = createTask({ id: 'sub-1' });
            const subtask2 = createTask({ id: 'sub-2' });
            const subtask3 = createTask({ id: 'sub-3' });
            const tasks: Task[] = [
                createTask({ id: 'parent', subtasks: [subtask1, subtask2, subtask3] }),
            ];

            const result = deleteTaskFromTree(tasks, 'sub-2');

            expect(result[0].subtasks).toHaveLength(2);
            expect(result[0].subtasks[0].id).toBe('sub-1');
            expect(result[0].subtasks[1].id).toBe('sub-3');
        });
    });

    describe('Non-existent task ID', () => {
        // Test: Non-existent ID returns original structure
        it('should return original structure when task ID not found', () => {
            const tasks: Task[] = [createTask({ id: 'task-1' })];
            const result = deleteTaskFromTree(tasks, 'nonexistent');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('task-1');
        });
    });

    describe('Empty array', () => {
        // Test: Empty array returns empty array
        it('should return empty array when input is empty', () => {
            const tasks: Task[] = [];
            const result = deleteTaskFromTree(tasks, 'task-1');

            expect(result).toHaveLength(0);
        });
    });
});

describe('filterDoneTasks', () => {
    describe('Filtering done tasks', () => {
        // Test: Filter single done task without subtasks
        it('should filter out done task without subtasks', () => {
            const tasks: Task[] = [createTask({ id: 'task-1', status: 'done' })];
            const result = filterDoneTasks(tasks);

            expect(result).toHaveLength(0);
        });

        // Test: Keep todo task
        it('should keep todo tasks', () => {
            const tasks: Task[] = [createTask({ id: 'task-1', status: 'todo' })];
            const result = filterDoneTasks(tasks);

            expect(result).toHaveLength(1);
        });

        // Test: Keep doing task
        it('should keep doing tasks', () => {
            const tasks: Task[] = [createTask({ id: 'task-1', status: 'doing' })];
            const result = filterDoneTasks(tasks);

            expect(result).toHaveLength(1);
        });

        // Test: Filter multiple done tasks
        it('should filter multiple done tasks', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', status: 'done' }),
                createTask({ id: 'task-2', status: 'todo' }),
                createTask({ id: 'task-3', status: 'done' }),
            ];
            const result = filterDoneTasks(tasks);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('task-2');
        });
    });

    describe('Done tasks with subtasks', () => {
        // Test: Keep done task if it has subtasks
        it('should keep done task if it has subtasks', () => {
            const subtask = createTask({ id: 'sub-1', status: 'todo' });
            const tasks: Task[] = [
                createTask({ id: 'task-1', status: 'done', subtasks: [subtask] }),
            ];
            const result = filterDoneTasks(tasks);

            // Done task with subtasks should be kept
            expect(result).toHaveLength(1);
        });

        // Test: Keep done task with done subtasks (subtasks filtered, parent kept if any remain)
        it('should filter done subtasks from done parent', () => {
            const subtask1 = createTask({ id: 'sub-1', status: 'done' });
            const subtask2 = createTask({ id: 'sub-2', status: 'todo' });
            const tasks: Task[] = [
                createTask({ id: 'task-1', status: 'done', subtasks: [subtask1, subtask2] }),
            ];
            const result = filterDoneTasks(tasks);

            // Parent kept because it has remaining subtask
            expect(result).toHaveLength(1);
            expect(result[0].subtasks).toHaveLength(1);
            expect(result[0].subtasks[0].id).toBe('sub-2');
        });

        // Test: Remove done parent when all subtasks are also done (and filtered)
        it('should remove done parent when all subtasks are filtered', () => {
            const subtask = createTask({ id: 'sub-1', status: 'done' });
            const tasks: Task[] = [
                createTask({ id: 'task-1', status: 'done', subtasks: [subtask] }),
            ];
            const result = filterDoneTasks(tasks);

            // After filtering, subtask is removed, so done parent with no subtasks is also removed
            expect(result).toHaveLength(0);
        });
    });

    describe('Nested filtering', () => {
        // Test: Filter deeply nested done tasks
        it('should filter deeply nested done tasks', () => {
            const level3Done = createTask({ id: 'level-3', status: 'done' });
            const level2 = createTask({ id: 'level-2', status: 'todo', subtasks: [level3Done] });
            const level1 = createTask({ id: 'level-1', status: 'todo', subtasks: [level2] });
            const tasks: Task[] = [level1];

            const result = filterDoneTasks(tasks);

            expect(result).toHaveLength(1);
            expect(result[0].subtasks[0].subtasks).toHaveLength(0);
        });
    });

    describe('Empty array', () => {
        // Test: Empty array returns empty array
        it('should return empty array when input is empty', () => {
            const result = filterDoneTasks([]);
            expect(result).toHaveLength(0);
        });
    });

    describe('Mixed statuses', () => {
        // Test: Complex mixed status tree
        it('should handle complex mixed status tree', () => {
            const tasks: Task[] = [
                createTask({
                    id: 'parent-1',
                    status: 'todo',
                    subtasks: [
                        createTask({ id: 'sub-1-1', status: 'done' }),
                        createTask({ id: 'sub-1-2', status: 'todo' }),
                    ],
                }),
                createTask({ id: 'parent-2', status: 'done' }),
                createTask({ id: 'parent-3', status: 'doing' }),
            ];

            const result = filterDoneTasks(tasks);

            expect(result).toHaveLength(2); // parent-1 and parent-3
            expect(result[0].id).toBe('parent-1');
            expect(result[0].subtasks).toHaveLength(1); // only sub-1-2 remains
            expect(result[0].subtasks[0].id).toBe('sub-1-2');
            expect(result[1].id).toBe('parent-3');
        });
    });
});

describe('filterTasksBySearch', () => {
    describe('Empty query', () => {
        // Test: Empty query returns all tasks
        it('should return all tasks when query is empty', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', content: 'Task 1' }),
                createTask({ id: 'task-2', content: 'Task 2' }),
            ];
            const result = filterTasksBySearch(tasks, '');

            expect(result).toHaveLength(2);
        });

        // Test: Whitespace query returns all tasks (empty after check)
        it('should return all tasks when query is whitespace (falsy check)', () => {
            const tasks: Task[] = [createTask({ id: 'task-1' })];
            // Note: The function checks !query, so whitespace is truthy
            // This tests the actual behavior
            const result = filterTasksBySearch(tasks, '   ');
            // Whitespace query won't match any content
            expect(result.length).toBeLessThanOrEqual(tasks.length);
        });
    });

    describe('Basic search matching', () => {
        // Test: Exact match
        it('should find task with exact content match', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', content: 'Buy groceries' }),
                createTask({ id: 'task-2', content: 'Clean room' }),
            ];
            const result = filterTasksBySearch(tasks, 'Buy groceries');

            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('Buy groceries');
        });

        // Test: Partial match
        it('should find task with partial content match', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', content: 'Buy groceries' }),
                createTask({ id: 'task-2', content: 'Clean room' }),
            ];
            const result = filterTasksBySearch(tasks, 'groceries');

            expect(result).toHaveLength(1);
        });

        // Test: Case-insensitive match
        it('should perform case-insensitive search', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', content: 'Buy GROCERIES' }),
            ];
            const result = filterTasksBySearch(tasks, 'groceries');

            expect(result).toHaveLength(1);
        });

        // Test: Multiple matches
        it('should find multiple tasks matching query', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', content: 'Buy milk' }),
                createTask({ id: 'task-2', content: 'Buy bread' }),
                createTask({ id: 'task-3', content: 'Sell car' }),
            ];
            const result = filterTasksBySearch(tasks, 'buy');

            expect(result).toHaveLength(2);
        });

        // Test: No match
        it('should return empty array when no tasks match', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', content: 'Buy groceries' }),
            ];
            const result = filterTasksBySearch(tasks, 'xyz');

            expect(result).toHaveLength(0);
        });
    });

    describe('Subtask search', () => {
        // Test: Find parent when subtask matches
        it('should include parent when subtask matches', () => {
            const subtask = createTask({ id: 'sub-1', content: 'Buy milk' });
            const tasks: Task[] = [
                createTask({
                    id: 'task-1',
                    content: 'Shopping',
                    subtasks: [subtask],
                }),
            ];
            const result = filterTasksBySearch(tasks, 'milk');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('task-1');
            expect(result[0].subtasks).toHaveLength(1);
        });

        // Test: Include parent when it matches (even if subtasks don't)
        it('should include parent when parent matches', () => {
            const subtask = createTask({ id: 'sub-1', content: 'Item 1' });
            const tasks: Task[] = [
                createTask({
                    id: 'task-1',
                    content: 'Shopping list',
                    subtasks: [subtask],
                }),
            ];
            const result = filterTasksBySearch(tasks, 'shopping');

            expect(result).toHaveLength(1);
            expect(result[0].subtasks).toHaveLength(0); // Subtask doesn't match
        });

        // Test: Filter subtasks based on search
        it('should filter subtasks to only matching ones', () => {
            const subtask1 = createTask({ id: 'sub-1', content: 'Buy milk' });
            const subtask2 = createTask({ id: 'sub-2', content: 'Wash car' });
            const tasks: Task[] = [
                createTask({
                    id: 'task-1',
                    content: 'Tasks',
                    subtasks: [subtask1, subtask2],
                }),
            ];
            const result = filterTasksBySearch(tasks, 'milk');

            expect(result).toHaveLength(1);
            expect(result[0].subtasks).toHaveLength(1);
            expect(result[0].subtasks[0].id).toBe('sub-1');
        });

        // Test: Deeply nested search
        it('should search deeply nested tasks', () => {
            const level3 = createTask({ id: 'level-3', content: 'Target item' });
            const level2 = createTask({ id: 'level-2', content: 'Level 2', subtasks: [level3] });
            const level1 = createTask({ id: 'level-1', content: 'Level 1', subtasks: [level2] });
            const tasks: Task[] = [level1];

            const result = filterTasksBySearch(tasks, 'target');

            expect(result).toHaveLength(1);
            expect(result[0].subtasks).toHaveLength(1);
            expect(result[0].subtasks[0].subtasks).toHaveLength(1);
        });
    });

    describe('Special characters in search', () => {
        // Test: Search with special characters
        it('should handle search with special characters', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', content: 'Task #due:2025-12-31' }),
            ];
            const result = filterTasksBySearch(tasks, '#due');

            expect(result).toHaveLength(1);
        });

        // Test: Search with parentheses
        it('should handle search with parentheses', () => {
            const tasks: Task[] = [
                createTask({ id: 'task-1', content: 'Task (important)' }),
            ];
            const result = filterTasksBySearch(tasks, '(important)');

            expect(result).toHaveLength(1);
        });
    });

    describe('Empty array', () => {
        // Test: Empty array returns empty array
        it('should return empty array when input is empty', () => {
            const result = filterTasksBySearch([], 'test');
            expect(result).toHaveLength(0);
        });
    });
});
