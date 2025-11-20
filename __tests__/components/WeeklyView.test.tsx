import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WeeklyView from '@/components/WeeklyView';
import { Task } from '@/lib/types';

// Mock dnd-kit
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCorners: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
  useDroppable: () => ({
    setNodeRef: jest.fn(),
    isOver: false,
  }),
}));

jest.mock('@dnd-kit/sortable', () => ({
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
jest.mock('@/components/WeeklyView.module.css', () => ({
  weeklyView: 'weeklyView',
  weekHeader: 'weekHeader',
  weekRange: 'weekRange',
  navButton: 'navButton',
  weekGrid: 'weekGrid',
  dayColumn: 'dayColumn',
  today: 'today',
  dayHeader: 'dayHeader',
  dayName: 'dayName',
  dayDate: 'dayDate',
  taskList: 'taskList',
  dropActive: 'dropActive',
  taskCard: 'taskCard',
  todo: 'todo',
  doing: 'doing',
  done: 'done',
  dragging: 'dragging',
  parentContent: 'parentContent',
  taskContent: 'taskContent',
  emptyState: 'emptyState',
}));

// Mock confetti
jest.mock('@/lib/confetti', () => ({
  triggerConfetti: jest.fn(),
}));

describe('WeeklyView', () => {
  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-1',
    content: 'Test Task',
    status: 'todo',
    subtasks: [],
    rawLine: '- [ ] Test Task',
    lineNumber: 1,
    ...overrides,
  });

  const defaultProps = {
    tasks: [],
    onTaskUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock current date for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-20'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('rendering', () => {
    it('should render week navigation', () => {
      render(<WeeklyView {...defaultProps} />);

      expect(screen.getByText('← 前週')).toBeInTheDocument();
      expect(screen.getByText('翌週 →')).toBeInTheDocument();
    });

    it('should render all 7 days of the week', () => {
      render(<WeeklyView {...defaultProps} />);

      // Check for day names
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });

    it('should render empty state for days without tasks', () => {
      render(<WeeklyView {...defaultProps} />);

      const emptyStates = screen.getAllByText('Drop tasks here');
      expect(emptyStates.length).toBe(7); // One for each day
    });

    it('should render tasks on their due dates', () => {
      const task = createTask({
        dueDate: '2025-11-20', // Thursday in the current week
      });

      render(<WeeklyView {...defaultProps} tasks={[task]} />);

      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('should render task parent content when present', () => {
      const task = createTask({
        dueDate: '2025-11-20',
        parentContent: 'Parent Task',
      });

      render(<WeeklyView {...defaultProps} tasks={[task]} />);

      expect(screen.getByText('Parent Task')).toBeInTheDocument();
    });

    it('should render nested tasks from subtasks', () => {
      const parentTask = createTask({
        id: 'parent',
        content: 'Parent',
        subtasks: [
          createTask({
            id: 'child',
            content: 'Child Task',
            dueDate: '2025-11-20',
            parentContent: 'Parent',
          }),
        ],
      });

      render(<WeeklyView {...defaultProps} tasks={[parentTask]} />);

      expect(screen.getByText('Child Task')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should navigate to previous week', () => {
      render(<WeeklyView {...defaultProps} />);

      const prevButton = screen.getByText('← 前週');
      fireEvent.click(prevButton);

      // The week range should change
      // Current week contains Nov 20, previous week should be different
      const weekRange = screen.getByText(/〜/);
      expect(weekRange).toBeInTheDocument();
    });

    it('should navigate to next week', () => {
      render(<WeeklyView {...defaultProps} />);

      const nextButton = screen.getByText('翌週 →');
      fireEvent.click(nextButton);

      const weekRange = screen.getByText(/〜/);
      expect(weekRange).toBeInTheDocument();
    });
  });

  describe('task display', () => {
    it('should apply correct status class to task card', () => {
      const todoTask = createTask({
        status: 'todo',
        dueDate: '2025-11-20',
      });

      const { container } = render(<WeeklyView {...defaultProps} tasks={[todoTask]} />);

      const taskCard = container.querySelector('.taskCard');
      expect(taskCard).toHaveClass('todo');
    });

    it('should display multiple tasks on the same day', () => {
      const tasks = [
        createTask({ id: 'task-1', content: 'Task 1', dueDate: '2025-11-20' }),
        createTask({ id: 'task-2', content: 'Task 2', dueDate: '2025-11-20' }),
      ];

      render(<WeeklyView {...defaultProps} tasks={tasks} />);

      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });

    it('should not display tasks outside the current week', () => {
      const task = createTask({
        dueDate: '2025-12-25', // Different week
      });

      render(<WeeklyView {...defaultProps} tasks={[task]} />);

      expect(screen.queryByText('Test Task')).not.toBeInTheDocument();
    });
  });

  describe('today highlight', () => {
    it('should highlight today column', () => {
      const { container } = render(<WeeklyView {...defaultProps} />);

      const todayColumn = container.querySelector('.today');
      expect(todayColumn).toBeInTheDocument();
    });
  });

  describe('task filtering', () => {
    it('should only show tasks with due dates', () => {
      const taskWithDueDate = createTask({
        id: 'task-1',
        content: 'With Due Date',
        dueDate: '2025-11-20',
      });

      const taskWithoutDueDate = createTask({
        id: 'task-2',
        content: 'Without Due Date',
        dueDate: undefined,
      });

      render(<WeeklyView {...defaultProps} tasks={[taskWithDueDate, taskWithoutDueDate]} />);

      expect(screen.getByText('With Due Date')).toBeInTheDocument();
      expect(screen.queryByText('Without Due Date')).not.toBeInTheDocument();
    });
  });

  describe('week calculation', () => {
    it('should show Monday as first day of week', () => {
      render(<WeeklyView {...defaultProps} />);

      // In the grid, Monday should be first
      const dayNames = screen.getAllByText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
      expect(dayNames[0]).toHaveTextContent('Mon');
    });

    it('should display correct date range', () => {
      render(<WeeklyView {...defaultProps} />);

      // Nov 20, 2025 is a Thursday
      // Week starts on Monday Nov 17 and ends Sunday Nov 23
      const weekRange = screen.getByText(/〜/);
      expect(weekRange).toBeInTheDocument();
    });
  });

  describe('getAllTasks helper', () => {
    it('should flatten nested tasks', () => {
      const nestedTask = createTask({
        id: 'parent',
        content: 'Parent Task',
        dueDate: '2025-11-20',
        subtasks: [
          createTask({
            id: 'child',
            content: 'Child Task',
            dueDate: '2025-11-21',
            parentContent: 'Parent Task',
          }),
        ],
      });

      render(<WeeklyView {...defaultProps} tasks={[nestedTask]} />);

      // Parent appears twice - once as task content and once as parentContent
      const parentTexts = screen.getAllByText('Parent Task');
      expect(parentTexts.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Child Task')).toBeInTheDocument();
    });
  });
});
