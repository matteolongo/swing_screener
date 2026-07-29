import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StopPreview from './StopPreview';

function findText(container: HTMLElement, pattern: string): boolean {
  return container.textContent?.includes(pattern) ?? false;
}

describe('StopPreview', () => {
  const defaultProps = {
    entry: 100,
    currentStop: 95,
    currentTarget: 120,
    shares: 50,
    onClose: () => {},
  };

  it('renders preview label', () => {
    render(<StopPreview {...defaultProps} />);
    expect(screen.getByText(/Preview/)).toBeInTheDocument();
    expect(screen.getByText(/not saved/)).toBeInTheDocument();
  });

  it('renders range slider', () => {
    render(<StopPreview {...defaultProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });

  it('displays computed Stop value', () => {
    const { container } = render(<StopPreview {...defaultProps} />);
    expect(findText(container, '$95.00')).toBe(true);
  });

  it('displays computed R:R for long', () => {
    const { container } = render(<StopPreview {...defaultProps} />);
    expect(container.textContent).toMatch(/R:R/);
  });

  it('displays computed Risk $', () => {
    const { container } = render(<StopPreview {...defaultProps} />);
    expect(findText(container, '$250.00')).toBe(true);
  });

  it('computes correct R:R for long', () => {
    const { container } = render(<StopPreview {...defaultProps} />);
    expect(container.textContent).toContain('5.00');
  });

  it('computes correct risk $ for long', () => {
    const { container } = render(<StopPreview {...defaultProps} />);
    expect(findText(container, '$250.00')).toBe(true);
  });

  it('computes correct R:R for short', () => {
    const { container } = render(
      <StopPreview
        entry={100}
        currentStop={105}
        currentTarget={90}
        shares={50}
        direction="short"
        onClose={() => {}}
      />,
    );
    expect(container.textContent).toContain('3.00');
  });

  it('computes correct risk $ for short', () => {
    const { container } = render(
      <StopPreview
        entry={100}
        currentStop={105}
        currentTarget={90}
        shares={50}
        direction="short"
        onClose={() => {}}
      />,
    );
    expect(findText(container, '$250.00')).toBe(true);
  });
});
