import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateProjectModal from '@/components/CreateProjectModal';

// Mock CSS modules
jest.mock('@/components/AddTaskModal.module.css', () => ({
  overlay: 'overlay',
  modal: 'modal',
  title: 'title',
  formGroup: 'formGroup',
  input: 'input',
  actions: 'actions',
  cancelButton: 'cancelButton',
  submitButton: 'submitButton',
}));

describe('CreateProjectModal', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render modal when isOpen is true', () => {
      render(<CreateProjectModal {...defaultProps} />);

      expect(screen.getByText('Create New Project')).toBeInTheDocument();
      expect(screen.getByLabelText('Project Title')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(<CreateProjectModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Create New Project')).not.toBeInTheDocument();
    });

    it('should render input field with placeholder', () => {
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByPlaceholderText('Enter project name...');
      expect(input).toBeInTheDocument();
    });

    it('should render Cancel and Create buttons', () => {
      render(<CreateProjectModal {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Create Project')).toBeInTheDocument();
    });

    it('should autofocus the input field', () => {
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      expect(input).toHaveFocus();
    });
  });

  describe('user interactions', () => {
    it('should update input value when user types', async () => {
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      await userEvent.type(input, 'My New Project');

      expect(input).toHaveValue('My New Project');
    });

    it('should call onClose when Cancel button is clicked', async () => {
      render(<CreateProjectModal {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', async () => {
      const { container } = render(<CreateProjectModal {...defaultProps} />);

      const overlay = container.querySelector('.overlay');
      if (overlay) {
        await userEvent.click(overlay);
      }

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', async () => {
      const { container } = render(<CreateProjectModal {...defaultProps} />);

      const modal = container.querySelector('.modal');
      if (modal) {
        await userEvent.click(modal);
      }

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('should call onSubmit with trimmed title when form is submitted', async () => {
      mockOnSubmit.mockResolvedValue(undefined);
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      const submitButton = screen.getByText('Create Project');

      await userEvent.type(input, '  My Project  ');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('My Project');
      });
    });

    it('should not call onSubmit when title is empty', async () => {
      render(<CreateProjectModal {...defaultProps} />);

      const submitButton = screen.getByText('Create Project');
      await userEvent.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should show error when title is empty', async () => {
      render(<CreateProjectModal {...defaultProps} />);

      const submitButton = screen.getByText('Create Project');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Project title is required')).toBeInTheDocument();
      });
    });

    it('should not call onSubmit when title is only whitespace', async () => {
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      const submitButton = screen.getByText('Create Project');

      await userEvent.type(input, '   ');
      await userEvent.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
      expect(screen.getByText('Project title is required')).toBeInTheDocument();
    });

    it('should have maxLength attribute to prevent long titles', () => {
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title') as HTMLInputElement;
      expect(input.maxLength).toBe(100);
    });

    it('should clear error when user starts typing after error', async () => {
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      const submitButton = screen.getByText('Create Project');

      // Trigger error
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Project title is required')).toBeInTheDocument();
      });

      // Start typing
      await userEvent.type(input, 'New Project');

      await waitFor(() => {
        expect(screen.queryByText('Project title is required')).not.toBeInTheDocument();
      });
    });

    it('should close modal and reset form after successful submission', async () => {
      mockOnSubmit.mockResolvedValue(undefined);
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      const submitButton = screen.getByText('Create Project');

      await userEvent.type(input, 'My Project');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('My Project');
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error message when submission fails', async () => {
      mockOnSubmit.mockRejectedValue(new Error('Failed to create project'));
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      const submitButton = screen.getByText('Create Project');

      await userEvent.type(input, 'My Project');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to create project')).toBeInTheDocument();
      });
    });

    it('should show loading state during submission', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      const submitButton = screen.getByText('Create Project');

      await userEvent.type(input, 'My Project');
      await userEvent.click(submitButton);

      expect(screen.getByText('Creating...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should disable Cancel button during submission', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      const submitButton = screen.getByText('Create Project');
      const cancelButton = screen.getByText('Cancel');

      await userEvent.type(input, 'My Project');
      await userEvent.click(submitButton);

      expect(cancelButton).toBeDisabled();
    });

    it('should prevent closing modal via Cancel button during submission', async () => {
      mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      const submitButton = screen.getByText('Create Project');
      const cancelButton = screen.getByText('Cancel');

      await userEvent.type(input, 'My Project');
      await userEvent.click(submitButton);

      // Wait for submission to start
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });

      // Cancel button should be disabled, so clicking it won't close
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('input validation', () => {
    it('should limit input to 100 characters', async () => {
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title') as HTMLInputElement;
      await userEvent.type(input, 'a'.repeat(150));

      expect(input.value.length).toBeLessThanOrEqual(100);
    });
  });

  describe('accessibility', () => {
    it('should have proper label for input', () => {
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      expect(input).toBeInTheDocument();
    });

    it('should render form element', () => {
      const { container } = render(<CreateProjectModal {...defaultProps} />);

      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('should submit form on Enter key', async () => {
      mockOnSubmit.mockResolvedValue(undefined);
      render(<CreateProjectModal {...defaultProps} />);

      const input = screen.getByLabelText('Project Title');
      await userEvent.type(input, 'My Project{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith('My Project');
      });
    });
  });
});
