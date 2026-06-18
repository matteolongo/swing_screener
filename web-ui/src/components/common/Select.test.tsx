import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Select from './Select';

describe('Select', () => {
  it('renders options and reflects the selected value', () => {
    renderWithProviders(
      <Select aria-label="venue" value="b" onChange={() => {}}>
        <option value="a">Alpha</option>
        <option value="b">Bravo</option>
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'venue' }) as HTMLSelectElement;
    expect(select.value).toBe('b');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('renders the canonical token-based classes and merges a caller className', () => {
    renderWithProviders(
      <Select aria-label="venue" className="md:max-w-xs">
        <option value="a">Alpha</option>
      </Select>,
    );
    const select = screen.getByRole('combobox', { name: 'venue' });
    expect(select).toHaveClass('bg-surface', 'text-foreground', 'md:max-w-xs');
  });

  it('forwards a ref to the underlying element', () => {
    const ref = createRef<HTMLSelectElement>();
    renderWithProviders(
      <Select aria-label="venue" ref={ref}>
        <option value="a">Alpha</option>
      </Select>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});
