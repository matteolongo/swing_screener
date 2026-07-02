import { render } from '@testing-library/react';
import StatusDot from './StatusDot';

describe('StatusDot', () => {
  it.each([
    ['ok', 'bg-success'],
    ['warn', 'bg-warning'],
    ['down', 'bg-danger'],
    ['idle', 'bg-muted/50'],
  ] as const)('tone %s renders %s', (tone, cls) => {
    const { container } = render(<StatusDot tone={tone} />);
    expect(container.firstChild).toHaveClass(cls);
  });

  it('adds pulse animation when pulse is set', () => {
    const { container } = render(<StatusDot tone="ok" pulse />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });
});
