import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StepTracker from './StepTracker';
import type { StepStatus } from '../../types/api';

describe('StepTracker', () => {
  it('renders default steps when empty', () => {
    render(<StepTracker steps={[]} isLoading={false} />);

    expect(screen.getByText('Screen')).toBeInTheDocument();
    expect(screen.getByText('Analyze')).toBeInTheDocument();
    expect(screen.getByText('Size')).toBeInTheDocument();
    expect(screen.getByText('Order')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();
  });

  it('renders done step with checkmark icon', () => {
    const steps: StepStatus[] = [
      { name: 'Screen', status: 'done' },
      { name: 'Analyze', status: 'done' },
      { name: 'Size', status: 'pending' },
    ];

    render(<StepTracker steps={steps} isLoading={false} />);

    const icons = screen.getAllByText('✅');
    expect(icons).toHaveLength(2);
  });

  it('renders pending step with pending icon', () => {
    const steps: StepStatus[] = [
      { name: 'Screen', status: 'pending' },
    ];

    render(<StepTracker steps={steps} isLoading={false} />);

    expect(screen.getByText('🔲')).toBeInTheDocument();
  });

  it('renders skipped step with skipped icon', () => {
    const steps: StepStatus[] = [
      { name: 'Screen', status: 'skipped' },
    ];

    render(<StepTracker steps={steps} isLoading={false} />);

    expect(screen.getByText('⬛')).toBeInTheDocument();
  });

  it('renders skeleton when loading', () => {
    const { container } = render(<StepTracker steps={[]} isLoading={true} />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});
