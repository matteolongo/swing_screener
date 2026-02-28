import { describe, expect, it } from 'vitest';
import { screen } from '@/test/utils';
import { renderWithProviders } from '@/test/utils';
import LearnPage from './Learn';

describe('Learn Page', () => {
  it('renders glossary sections and entries', () => {
    renderWithProviders(<LearnPage />, { route: '/learn' });

    expect(screen.getByRole('heading', { name: 'Learn & Glossary' })).toBeInTheDocument();
    expect(screen.getByText('Setup Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Risk Controls')).toBeInTheDocument();
    expect(screen.getByText('RR')).toBeInTheDocument();
  });

  it('filters glossary entries by label search', async () => {
    const { user } = renderWithProviders(<LearnPage />, { route: '/learn' });

    const searchInput = screen.getByRole('searchbox', { name: 'Search glossary by label' });
    await user.type(searchInput, 'ZZZ');

    expect(screen.getByDisplayValue('ZZZ')).toBeInTheDocument();
    expect(screen.getByText('No glossary terms match your current search.')).toBeInTheDocument();
  });
});
