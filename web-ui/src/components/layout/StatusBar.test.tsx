import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { messagesEn } from '@/i18n/messages.en';
import { useScreenerStore } from '@/stores/screenerStore';
import type { ScreenerResponse } from '@/features/screener/types';
import StatusBar from './StatusBar';

describe('StatusBar', () => {
  afterEach(() => {
    useScreenerStore.getState().clearLastResult();
  });

  it('shows the active strategy chip linking to /system/strategy', async () => {
    renderWithProviders(<StatusBar />);
    const chip = await screen.findByRole('link', { name: /Default/ });
    expect(chip).toHaveAttribute('href', '/system/strategy');
  });

  it('shows equity from the portfolio summary', async () => {
    renderWithProviders(<StatusBar />);
    expect(await screen.findByText(new RegExp(messagesEn.statusBar.equity))).toBeInTheDocument();
  });

  it('toggles the sidebar', () => {
    const onToggle = vi.fn();
    renderWithProviders(<StatusBar onToggleSidebar={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(messagesEn.header.hideNavigation) }));
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows a freshness badge when the screener store has a last result', async () => {
    const mockResult: ScreenerResponse = {
      candidates: [],
      asofDate: '2026-07-01',
      totalScreened: 0,
      dataFreshness: 'final_close',
    };
    useScreenerStore.getState().setLastResult(mockResult);

    renderWithProviders(<StatusBar />);
    expect(await screen.findByText(new RegExp(messagesEn.badges.freshness.finalClose))).toBeInTheDocument();
  });

  it('hides the freshness badge when the screener store has no last result', async () => {
    renderWithProviders(<StatusBar />);
    await screen.findByRole('link', { name: /Default/ });
    expect(screen.queryByText(new RegExp(messagesEn.badges.freshness.finalClose))).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(messagesEn.badges.freshness.intraday))).not.toBeInTheDocument();
  });
});
