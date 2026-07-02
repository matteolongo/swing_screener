import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { messagesEn } from '@/i18n/messages.en';
import Today from './Today';

describe('Today page', () => {
  it('renders the inbox, positions, and calendar directly, without a tab bar', async () => {
    renderWithProviders(<Today />);

    expect(await screen.findByText(messagesEn.todayPage.positionsCard.title)).toBeInTheDocument();
    expect(screen.getByText(messagesEn.todayPage.calendarPeek.title)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(messagesEn.screenerPage.tabs.candidates)).not.toBeInTheDocument();
    expect(screen.queryByText(messagesEn.screenerPage.tabs.watchlist)).not.toBeInTheDocument();
  });
});
