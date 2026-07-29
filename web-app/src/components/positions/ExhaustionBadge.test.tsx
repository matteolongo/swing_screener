import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExhaustionBadge from './ExhaustionBadge';

describe('ExhaustionBadge', () => {
  it('renders gray dash for null score', () => {
    render(<ExhaustionBadge score={null} />);
    const badge = screen.getByText('\u2014');
    expect(badge).toBeInTheDocument();
  });

  it('renders green Healthy for score 0-3', () => {
    render(<ExhaustionBadge score={2} />);
    const label = screen.getByText('Healthy');
    expect(label).toBeInTheDocument();
    expect(label.className).toContain('text-success');
  });

  it('renders amber Watch for score 4-6', () => {
    render(<ExhaustionBadge score={5} />);
    const label = screen.getByText('Watch');
    expect(label).toBeInTheDocument();
    expect(label.className).toContain('text-warning');
  });

  it('renders red Exhausted for score 7-10', () => {
    render(<ExhaustionBadge score={9} />);
    const label = screen.getByText('Exhausted');
    expect(label).toBeInTheDocument();
    expect(label.className).toContain('text-danger');
  });

  it('renders timestamp when provided', () => {
    render(<ExhaustionBadge score={2} timestamp="2025-01-15" />);
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
  });

  it('handles score boundary at 0', () => {
    render(<ExhaustionBadge score={0} />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('handles score boundary at 7', () => {
    render(<ExhaustionBadge score={7} />);
    expect(screen.getByText('Exhausted')).toBeInTheDocument();
  });

  it('applies className prop', () => {
    const { container } = render(<ExhaustionBadge score={2} className="extra-class" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain('extra-class');
  });
});
