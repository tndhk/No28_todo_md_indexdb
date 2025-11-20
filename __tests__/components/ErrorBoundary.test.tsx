import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '@/components/ErrorBoundary';

// Mock CSS modules
jest.mock('@/components/ErrorBoundary.module.css', () => ({
  errorContainer: 'errorContainer',
  errorContent: 'errorContent',
  errorIcon: 'errorIcon',
  errorTitle: 'errorTitle',
  errorMessage: 'errorMessage',
  errorActions: 'errorActions',
  retryButton: 'retryButton',
  reloadButton: 'reloadButton',
}));

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

// Component that can be controlled to throw
const ConditionalError = ({ error }: { error?: Error }) => {
  if (error) {
    throw error;
  }
  return <div>Working component</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Child component</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child component')).toBeInTheDocument();
    });

    it('should render error UI when child throws', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should display error message from thrown error', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('should render default error message when error has no message', () => {
      const ErrorWithNoMessage = () => {
        throw new Error();
      };

      render(
        <ErrorBoundary>
          <ErrorWithNoMessage />
        </ErrorBoundary>
      );

      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
    });

    it('should render error icon', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Check for SVG icon
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render retry button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should render reload button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });
  });

  describe('custom fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should not render default error UI when custom fallback is provided', () => {
      const customFallback = <div>Custom fallback</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
      expect(screen.queryByText('Reload Page')).not.toBeInTheDocument();
    });
  });

  describe('error callback', () => {
    it('should call onError when error is caught', () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(onError.mock.calls[0][0].message).toBe('Test error message');
    });

    it('should provide errorInfo to onError callback', () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][1]).toHaveProperty('componentStack');
    });

    it('should not crash if onError is not provided', () => {
      expect(() => {
        render(
          <ErrorBoundary>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        );
      }).not.toThrow();
    });
  });

  describe('retry functionality', () => {
    it('should call handleRetry when retry button is clicked', async () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeInTheDocument();

      // Verify retry button exists and can be clicked
      await userEvent.click(retryButton);

      // After retry, error boundary attempts to re-render children
      // Note: In test environment, the error will re-throw if condition persists
    });

    it('should have accessible retry button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeInTheDocument();
      expect(retryButton.tagName).toBe('BUTTON');
    });

    it('should show error again if retry still fails', async () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const retryButton = screen.getByText('Try Again');
      await userEvent.click(retryButton);

      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('reload functionality', () => {
    it('should have reload button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByText('Reload Page');
      expect(reloadButton).toBeInTheDocument();
      expect(reloadButton.tagName).toBe('BUTTON');
    });
  });

  describe('error types', () => {
    it('should catch TypeError', () => {
      const ThrowTypeError = () => {
        throw new TypeError('Type error occurred');
      };

      render(
        <ErrorBoundary>
          <ThrowTypeError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Type error occurred')).toBeInTheDocument();
    });

    it('should catch ReferenceError', () => {
      const ThrowReferenceError = () => {
        throw new ReferenceError('Reference error occurred');
      };

      render(
        <ErrorBoundary>
          <ThrowReferenceError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Reference error occurred')).toBeInTheDocument();
    });

    it('should catch custom errors', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const ThrowCustomError = () => {
        throw new CustomError('Custom error occurred');
      };

      render(
        <ErrorBoundary>
          <ThrowCustomError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error occurred')).toBeInTheDocument();
    });
  });

  describe('multiple children', () => {
    it('should render multiple children when no error', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });

    it('should catch error from any child', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <ThrowError shouldThrow={true} />
          <div>Child 3</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Child 3')).not.toBeInTheDocument();
    });
  });

  describe('nested error boundaries', () => {
    it('should only catch errors in immediate children', () => {
      const onInnerError = jest.fn();
      const onOuterError = jest.fn();

      render(
        <ErrorBoundary onError={onOuterError}>
          <div>Outer boundary</div>
          <ErrorBoundary onError={onInnerError}>
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        </ErrorBoundary>
      );

      expect(onInnerError).toHaveBeenCalled();
      expect(onOuterError).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle errors with very long messages', () => {
      const longMessage = 'Error: ' + 'A'.repeat(1000);
      const ThrowLongError = () => {
        throw new Error(longMessage);
      };

      render(
        <ErrorBoundary>
          <ThrowLongError />
        </ErrorBoundary>
      );

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle errors with special characters in message', () => {
      const specialMessage = 'Error with "quotes" & <brackets> and #hashtags';
      const ThrowSpecialError = () => {
        throw new Error(specialMessage);
      };

      render(
        <ErrorBoundary>
          <ThrowSpecialError />
        </ErrorBoundary>
      );

      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });

    it('should maintain error UI with consistent error', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error state should be displayed
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();

      // Both buttons should be present
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });
  });

  describe('console logging', () => {
    it('should log error to console', () => {
      const consoleErrorSpy = console.error as jest.MockedFunction<typeof console.error>;

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
