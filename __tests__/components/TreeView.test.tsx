import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TreeView from '@/components/TreeView';
import { Task } from '@/lib/types';

// Mock dnd-kit
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: jest.fn(),
  verticalListSortingStrategy: jest.fn(),
  arrayMove: jest.fn((arr, from, to) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => null,
    },
  },
}));

// Mock CSS modules
jest.mock('@/components/TreeView.module.css', () => ({
  treeView: 'treeView',
  taskItem: 'taskItem',
  taskRow: 'taskRow',
  taskContent: 'taskContent',
  completed: 'completed',
  checkbox: 'checkbox',
  checked: 'checked',
  actions: 'actions',
  actionButton: 'actionButton',
  expandButton: 'expandButton',
  expandSpacer: 'expandSpacer',
  subtasks: 'subtasks',
  addTaskContainer: 'addTaskContainer',
  addTaskButton: 'addTaskButton',
  dragHandle: 'dragHandle',
  editContainer: 'editContainer',
  editInput: 'editInput',
  editDateInput: 'editDateInput',
  dueDate: 'dueDate',
}));

describe('TreeView', () => {
  const mockTask: Task = {
    id: 'test-1',
    content: 'Test Task',
    status: 'todo',
    subtasks: [],
    rawLine: '- [ ] Test Task',
    lineNumber: 1,
  };

  const mockTaskWithSubtasks: Task = {
    id: 'test-1',
    content: 'Parent Task',
    status: 'todo',
    subtasks: [
      {
        id: 'test-2',
        content: 'Child Task',
        status: 'todo',
        subtasks: [],
        rawLine: '    - [ ] Child Task',
        lineNumber: 2,
        parentId: 'test-1',
        parentContent: 'Parent Task',
      },
    ],
    rawLine: '- [ ] Parent Task',
    lineNumber: 1,
  };

  const defaultProps = {
    tasks: [mockTask],
    onTaskToggle: jest.fn(),
    onTaskDelete: jest.fn(),
    onTaskAdd: jest.fn(),
    onTaskUpdate: jest.fn(),
    onTaskReorder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render tasks', () => {
      render(<TreeView {...defaultProps} />);

      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('should render multiple tasks', () => {
      const tasks = [
        { ...mockTask, id: 'test-1', content: 'Task 1' },
        { ...mockTask, id: 'test-2', content: 'Task 2' },
      ];

      render(<TreeView {...defaultProps} tasks={tasks} />);

      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });

    it('should render subtasks', () => {
      render(<TreeView {...defaultProps} tasks={[mockTaskWithSubtasks]} />);

      expect(screen.getByText('Parent Task')).toBeInTheDocument();
      expect(screen.getByText('Child Task')).toBeInTheDocument();
    });

    it('should render Add Task button', () => {
      render(<TreeView {...defaultProps} />);

      expect(screen.getByText('Add Task')).toBeInTheDocument();
    });

    it('should display due date when present', () => {
      const taskWithDueDate: Task = {
        ...mockTask,
        dueDate: '2025-12-25',
      };

      render(<TreeView {...defaultProps} tasks={[taskWithDueDate]} />);

      // The date is formatted as Japanese short format
      expect(screen.getByText(/12/)).toBeInTheDocument();
    });

    it('should show completed style for done tasks', () => {
      const doneTask: Task = {
        ...mockTask,
        status: 'done',
      };

      render(<TreeView {...defaultProps} tasks={[doneTask]} />);

      const taskContent = screen.getByText('Test Task');
      expect(taskContent).toHaveClass('completed');
    });
  });

  describe('interactions', () => {
    it('should call onTaskToggle when checkbox is clicked', async () => {
      render(<TreeView {...defaultProps} />);

      const checkboxes = screen.getAllByRole('button');
      const checkbox = checkboxes.find(btn =>
        btn.querySelector('svg')?.parentElement?.className?.includes('checkbox')
      );

      if (checkbox) {
        await userEvent.click(checkbox);
        expect(defaultProps.onTaskToggle).toHaveBeenCalledWith(mockTask);
      }
    });

    it('should call onTaskDelete when delete button is clicked', async () => {
      render(<TreeView {...defaultProps} />);

      const deleteButton = screen.getByTitle('Delete task');
      await userEvent.click(deleteButton);

      expect(defaultProps.onTaskDelete).toHaveBeenCalledWith(mockTask);
    });

    it('should call onTaskAdd with no parent when Add Task button is clicked', async () => {
      render(<TreeView {...defaultProps} />);

      const addButton = screen.getByText('Add Task');
      await userEvent.click(addButton);

      expect(defaultProps.onTaskAdd).toHaveBeenCalledWith();
    });

    it('should call onTaskAdd with parent when add subtask button is clicked', async () => {
      render(<TreeView {...defaultProps} />);

      const addSubtaskButton = screen.getByTitle('Add subtask');
      await userEvent.click(addSubtaskButton);

      expect(defaultProps.onTaskAdd).toHaveBeenCalledWith(mockTask);
    });

    it('should enter edit mode when edit button is clicked', async () => {
      render(<TreeView {...defaultProps} />);

      const editButton = screen.getByTitle('Edit task');
      await userEvent.click(editButton);

      // Check for input field
      expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
    });

    it('should enter edit mode on double click', async () => {
      render(<TreeView {...defaultProps} />);

      const taskContent = screen.getByText('Test Task');
      await userEvent.dblClick(taskContent);

      expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
    });
  });

  describe('editing', () => {
    it('should update task on Enter key', async () => {
      render(<TreeView {...defaultProps} />);

      // Enter edit mode
      const editButton = screen.getByTitle('Edit task');
      await userEvent.click(editButton);

      // Change content and press Enter
      const input = screen.getByDisplayValue('Test Task');
      await userEvent.clear(input);
      await userEvent.type(input, 'Updated Task{Enter}');

      expect(defaultProps.onTaskUpdate).toHaveBeenCalledWith(
        mockTask,
        expect.objectContaining({ content: 'Updated Task' })
      );
    });

    it('should cancel edit on Escape key', async () => {
      render(<TreeView {...defaultProps} />);

      // Enter edit mode
      const editButton = screen.getByTitle('Edit task');
      await userEvent.click(editButton);

      // Change content and press Escape
      const input = screen.getByDisplayValue('Test Task');
      await userEvent.clear(input);
      await userEvent.type(input, 'Updated Task{Escape}');

      // Should exit edit mode without saving
      expect(defaultProps.onTaskUpdate).not.toHaveBeenCalled();
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('should save on blur', async () => {
      render(<TreeView {...defaultProps} />);

      // Enter edit mode
      const editButton = screen.getByTitle('Edit task');
      await userEvent.click(editButton);

      // Change content
      const input = screen.getByDisplayValue('Test Task');
      await userEvent.clear(input);
      await userEvent.type(input, 'Blurred Task');

      // Blur the input
      fireEvent.blur(input);

      expect(defaultProps.onTaskUpdate).toHaveBeenCalled();
    });
  });

  describe('expand/collapse', () => {
    it('should collapse subtasks when collapse button is clicked', async () => {
      render(<TreeView {...defaultProps} tasks={[mockTaskWithSubtasks]} />);

      // Initially expanded
      expect(screen.getByText('Child Task')).toBeInTheDocument();

      // Find and click collapse button by class name
      const buttons = screen.getAllByRole('button');
      const expandButton = buttons.find(btn =>
        btn.className?.includes('expandButton')
      );

      expect(expandButton).toBeDefined();
      if (expandButton) {
        await userEvent.click(expandButton);
        // After collapse, child should not be visible
        expect(screen.queryByText('Child Task')).not.toBeInTheDocument();
      }
    });
  });

  describe('empty state', () => {
    it('should render without tasks', () => {
      render(<TreeView {...defaultProps} tasks={[]} />);

      expect(screen.getByText('Add Task')).toBeInTheDocument();
    });
  });
});
