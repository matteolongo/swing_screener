import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Input from './Input';

describe('Input', () => {
  it('renders the canonical token-based classes', () => {
    renderWithProviders(<Input aria-label="amount" />);
    const input = screen.getByLabelText('amount');
    expect(input).toHaveClass('bg-surface', 'text-foreground', 'border-border');
  });

  it('merges a caller-provided className', () => {
    renderWithProviders(<Input aria-label="amount" className="mt-2" />);
    expect(screen.getByLabelText('amount')).toHaveClass('mt-2', 'bg-surface');
  });

  it('forwards arbitrary input props', () => {
    renderWithProviders(<Input aria-label="amount" type="number" placeholder="0" disabled />);
    const input = screen.getByLabelText('amount') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.placeholder).toBe('0');
    expect(input.disabled).toBe(true);
  });

  it('forwards a ref to the underlying element', () => {
    const ref = createRef<HTMLInputElement>();
    renderWithProviders(<Input aria-label="amount" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
