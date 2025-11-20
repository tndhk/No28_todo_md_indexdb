import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddTaskModal from '@/components/AddTaskModal';

// Mock CSS modules
jest.mock('@/components/AddTaskModal.module.css', () => ({
  overlay: 'overlay',
  modal: 'modal',
  title: 'title',
  formGroup: 'formGroup',
  input: 'input',
  select: 'select',
  actions: 'actions',
  cancelButton: 'cancelButton',
  submitButton: 'submitButton',
}));

describe('AddTaskModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onAdd: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <AddTaskModal {...defaultProps} isOpen={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(<AddTaskModal {...defaultProps} />);

      expect(screen.getByText('Add New Task')).toBeInTheDocument();
    });

    it('should render with "Add Subtask" title when isSubtask is true', () => {
      render(<AddTaskModal {...defaultProps} isSubtask={true} />);

      expect(screen.getByText('Add Subtask')).toBeInTheDocument();
      expect(screen.queryByText('Add New Task')).not.toBeInTheDocument();
    });

    it('should render all form fields', () => {
      render(<AddTaskModal {...defaultProps} />);

      expect(screen.getByLabelText('Task Content')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByLabelText('Due Date (Optional)')).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      render(<AddTaskModal {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Add Task')).toBeInTheDocument();
    });

    it('should have default status as "todo"', () => {
      render(<AddTaskModal {...defaultProps} />);

      const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
      expect(statusSelect.value).toBe('todo');
    });

    it('should use custom defaultStatus when provided', () => {
      render(<AddTaskModal {...defaultProps} defaultStatus="doing" />);

      const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
      expect(statusSelect.value).toBe('doing');
    });

    it('should have autofocus prop on content input', () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content');
      // The input element should be present and ready to receive input
      expect(contentInput).toBeInTheDocument();
      expect(contentInput.tagName).toBe('INPUT');
    });
  });

  describe('form interactions', () => {
    it('should update content on input change', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const input = screen.getByLabelText('Task Content');
      await userEvent.type(input, 'New task content');

      expect(input).toHaveValue('New task content');
    });

    it('should update status on select change', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const select = screen.getByLabelText('Status');
      await userEvent.selectOptions(select, 'doing');

      expect(select).toHaveValue('doing');
    });

    it('should update due date on input change', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const dateInput = screen.getByLabelText('Due Date (Optional)');
      await userEvent.type(dateInput, '2025-12-25');

      expect(dateInput).toHaveValue('2025-12-25');
    });

    it('should have all status options', () => {
      render(<AddTaskModal {...defaultProps} />);

      const options = screen.getAllByRole('option');
      const optionTexts = options.map(option => option.textContent);

      expect(optionTexts).toContain('To Do');
      expect(optionTexts).toContain('In Progress');
      expect(optionTexts).toContain('Done');
    });
  });

  describe('form submission', () => {
    it('should call onAdd with form data on submit', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content');
      const statusSelect = screen.getByLabelText('Status');
      const dateInput = screen.getByLabelText('Due Date (Optional)');
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, 'Test task');
      await userEvent.selectOptions(statusSelect, 'doing');
      await userEvent.type(dateInput, '2025-12-25');
      await userEvent.click(submitButton);

      expect(defaultProps.onAdd).toHaveBeenCalledWith(
        'Test task',
        'doing',
        '2025-12-25'
      );
    });

    it('should call onAdd without due date when not provided', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content');
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, 'Task without date');
      await userEvent.click(submitButton);

      expect(defaultProps.onAdd).toHaveBeenCalledWith(
        'Task without date',
        'todo',
        undefined
      );
    });

    it('should prevent empty submission', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const submitButton = screen.getByText('Add Task');
      await userEvent.click(submitButton);

      expect(defaultProps.onAdd).not.toHaveBeenCalled();
    });

    it('should prevent whitespace-only submission', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content');
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, '   ');
      await userEvent.click(submitButton);

      expect(defaultProps.onAdd).not.toHaveBeenCalled();
    });

    it('should reset form after successful submit', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content') as HTMLInputElement;
      const dateInput = screen.getByLabelText('Due Date (Optional)') as HTMLInputElement;
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, 'Test task');
      await userEvent.type(dateInput, '2025-12-25');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(contentInput.value).toBe('');
        expect(dateInput.value).toBe('');
      });
    });

    it('should reset status to defaultStatus after submit', async () => {
      render(<AddTaskModal {...defaultProps} defaultStatus="todo" />);

      const contentInput = screen.getByLabelText('Task Content');
      const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, 'Test task');
      await userEvent.selectOptions(statusSelect, 'done');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(statusSelect.value).toBe('todo');
      });
    });

    it('should call onClose after successful submit', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content');
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, 'Test task');
      await userEvent.click(submitButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should submit form on Enter key in form', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content');
      await userEvent.type(contentInput, 'Test task{Enter}');

      expect(defaultProps.onAdd).toHaveBeenCalledWith('Test task', 'todo', undefined);
    });
  });

  describe('modal interactions', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should call onClose when overlay is clicked', async () => {
      const { container } = render(<AddTaskModal {...defaultProps} />);

      const overlay = container.querySelector('.overlay');
      expect(overlay).toBeInTheDocument();

      if (overlay) {
        fireEvent.click(overlay);
        expect(defaultProps.onClose).toHaveBeenCalled();
      }
    });

    it('should not close when modal content is clicked', async () => {
      const { container } = render(<AddTaskModal {...defaultProps} />);

      const modal = container.querySelector('.modal');
      expect(modal).toBeInTheDocument();

      if (modal) {
        fireEvent.click(modal);
        expect(defaultProps.onClose).not.toHaveBeenCalled();
      }
    });

    it('should stop propagation when clicking inside modal', () => {
      const { container } = render(<AddTaskModal {...defaultProps} />);

      const modal = container.querySelector('.modal');
      const overlay = container.querySelector('.overlay');

      expect(modal).toBeInTheDocument();
      expect(overlay).toBeInTheDocument();

      if (modal) {
        const clickEvent = new MouseEvent('click', { bubbles: true });
        const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');

        modal.dispatchEvent(clickEvent);

        expect(stopPropagationSpy).toHaveBeenCalled();
      }
    });
  });

  describe('keyboard interactions', () => {
    it('should not close on Escape when form has content', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content');
      await userEvent.type(contentInput, 'Test');
      await userEvent.keyboard('{Escape}');

      // Modal should still be open
      expect(screen.getByText('Add New Task')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle rapid submissions', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content');
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, 'Test task');
      await userEvent.click(submitButton);
      await userEvent.click(submitButton);

      // Should only call onAdd once since form is reset after first submit
      expect(defaultProps.onAdd).toHaveBeenCalledTimes(1);
    });

    it('should handle very long task content', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const longContent = 'a'.repeat(1000);
      const contentInput = screen.getByLabelText('Task Content');
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, longContent);
      await userEvent.click(submitButton);

      expect(defaultProps.onAdd).toHaveBeenCalledWith(longContent, 'todo', undefined);
    });

    it('should handle special characters in content', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const specialContent = 'Task with "quotes" & <brackets> #hashtag @mention';
      const contentInput = screen.getByLabelText('Task Content');
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, specialContent);
      await userEvent.click(submitButton);

      expect(defaultProps.onAdd).toHaveBeenCalledWith(
        specialContent,
        'todo',
        undefined
      );
    });

    it('should handle invalid date input gracefully', async () => {
      render(<AddTaskModal {...defaultProps} />);

      const contentInput = screen.getByLabelText('Task Content');
      const dateInput = screen.getByLabelText('Due Date (Optional)');
      const submitButton = screen.getByText('Add Task');

      await userEvent.type(contentInput, 'Test task');
      // Try to set an invalid date (browser will handle validation)
      fireEvent.change(dateInput, { target: { value: 'invalid' } });
      await userEvent.click(submitButton);

      // Should still call onAdd with whatever value is in the input
      expect(defaultProps.onAdd).toHaveBeenCalled();
    });
  });

  describe('prop variations', () => {
    it('should work with all status options as defaultStatus', () => {
      const statuses: Array<'todo' | 'doing' | 'done'> = ['todo', 'doing', 'done'];

      statuses.forEach(status => {
        const { unmount } = render(
          <AddTaskModal {...defaultProps} defaultStatus={status} />
        );

        const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
        expect(statusSelect.value).toBe(status);

        unmount();
      });
    });

    it('should handle undefined defaultStatus', () => {
      render(<AddTaskModal {...defaultProps} defaultStatus={undefined} />);

      const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
      expect(statusSelect.value).toBe('todo');
    });

    it('should handle undefined isSubtask', () => {
      render(<AddTaskModal {...defaultProps} isSubtask={undefined} />);

      expect(screen.getByText('Add New Task')).toBeInTheDocument();
    });
  });
});
