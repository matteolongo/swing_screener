import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import CollapsibleSection from './CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders the title and children', () => {
    renderWithProviders(
      <CollapsibleSection title="Trend">
        <p>inner content</p>
      </CollapsibleSection>,
    );
    expect(screen.getByText('Trend')).toBeInTheDocument();
    expect(screen.getByText('inner content')).toBeInTheDocument();
  });

  it('is closed by default', () => {
    const { container } = renderWithProviders(
      <CollapsibleSection title="Trend">x</CollapsibleSection>,
    );
    expect(container.querySelector('details')).not.toHaveAttribute('open');
  });

  it('honors defaultOpen', () => {
    const { container } = renderWithProviders(
      <CollapsibleSection title="Trend" defaultOpen>
        x
      </CollapsibleSection>,
    );
    expect(container.querySelector('details')).toHaveAttribute('open');
  });
});
