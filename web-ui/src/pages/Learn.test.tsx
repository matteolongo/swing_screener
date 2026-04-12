import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import Learn from './Learn';

vi.mock('@/components/domain/learn/CoreConceptsSection', () => ({
  default: () => <div>Core Concepts Section</div>,
}));

vi.mock('@/components/domain/learn/GlossaryGrid', () => ({
  default: () => <div>Glossary Grid</div>,
}));

vi.mock('@/components/domain/learn/MethodSettingsPanel', () => ({
  default: () => <div>Method Settings Panel</div>,
}));

vi.mock('@/components/domain/learn/PowerToolsPanel', () => ({
  default: () => <div>Power Tools Panel</div>,
}));

describe('Learn Page', () => {
  it('renders all learn sections', () => {
    renderWithProviders(<Learn />, { route: '/learn' });

    expect(screen.getByText('Core Concepts Section')).toBeInTheDocument();
    expect(screen.getByText('Glossary Grid')).toBeInTheDocument();
    expect(screen.getByText('Method Settings Panel')).toBeInTheDocument();
    expect(screen.getByText('Power Tools Panel')).toBeInTheDocument();
  });
});
