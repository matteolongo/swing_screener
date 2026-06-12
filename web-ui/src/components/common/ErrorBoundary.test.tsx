import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom({ explode }: { explode: boolean }): JSX.Element {
  if (explode) {
    throw new Error('kaboom');
  }
  return <div>recovered</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('renders the default fallback with the error message when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom explode />
      </ErrorBoundary>
    );
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={(error) => <div>custom: {error.message}</div>}>
        <Boom explode />
      </ErrorBoundary>
    );
    expect(screen.getByText('custom: kaboom')).toBeInTheDocument();
  });

  it('recovers when reset is invoked and the child no longer throws', () => {
    function Wrapper() {
      return (
        <ErrorBoundary>
          <Boom explode={shouldExplode} />
        </ErrorBoundary>
      );
    }
    let shouldExplode = true;
    const { rerender } = render(<Wrapper />);

    expect(screen.getByText('kaboom')).toBeInTheDocument();

    // Update the captured children to the non-throwing variant before resetting,
    // then reset so the boundary re-renders the now-safe children.
    shouldExplode = false;
    rerender(<Wrapper />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('recovered')).toBeInTheDocument();
  });
});
