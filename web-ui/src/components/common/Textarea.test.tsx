import { describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Field from './Field';
import Textarea from './Textarea';

describe('Textarea', () => {
  it('renders the canonical token-based classes', () => {
    renderWithProviders(<Textarea aria-label="notes" />);
    const el = screen.getByLabelText('notes');
    expect(el).toHaveClass('bg-surface', 'text-foreground', 'border-border');
  });

  it('merges a caller-provided className', () => {
    renderWithProviders(<Textarea aria-label="notes" className="resize-none" />);
    expect(screen.getByLabelText('notes')).toHaveClass('resize-none', 'bg-surface');
  });

  it('forwards arbitrary textarea props', () => {
    renderWithProviders(<Textarea aria-label="notes" rows={4} placeholder="why?" />);
    const el = screen.getByLabelText('notes') as HTMLTextAreaElement;
    expect(el).toHaveAttribute('rows', '4');
    expect(el.placeholder).toBe('why?');
  });

  it('forwards a ref and associates with a Field label', () => {
    const ref = createRef<HTMLTextAreaElement>();
    renderWithProviders(
      <Field label="Reason">
        <Textarea ref={ref} defaultValue="x" />
      </Field>,
    );
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect((screen.getByLabelText('Reason') as HTMLTextAreaElement).value).toBe('x');
  });
});
