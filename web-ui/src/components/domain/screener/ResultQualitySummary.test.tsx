import { describe, expect, it, vi } from 'vitest';
import { Link } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import { openNativeDisclosure, renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import type { ScreenerResponse } from '@/features/screener/types';
import ResultQualitySummary from './ResultQualitySummary';

const result: ScreenerResponse = { asofDate: '2026-10-14', totalScreened: 4, totalWithMarketData: 4,
  dataFreshness: 'final_close', candidates: [], benchmarkLastBar: '2026-10-14' };

describe('ResultQualitySummary', () => {
  it('opens and focuses quality details from the badge destination, including repeat visits', async () => {
    const { user } = renderWithProviders(<>
      <Link to="/today#scan-data-quality">{t('screener.quality.inspect')}</Link>
      <ResultQualitySummary result={result} isRefreshing={false} error={null} />
    </>, { route: '/today', router: 'memory' });
    const summary = screen.getByText(t('cockpit.review.scanDetails')).closest('summary')!;
    const details = summary.parentElement as HTMLDetailsElement;
    const link = screen.getByRole('link', { name: t('screener.quality.inspect') });
    await user.click(link);
    // Happy DOM does not reflect details.open to the attribute.
    await waitFor(() => expect(details.open).toBe(true));
    expect(summary).toHaveFocus();
    details.open = false;
    await user.click(link);
    await waitFor(() => expect(details.open).toBe(true));
    expect(summary).toHaveFocus();
  });
  it('identifies stale symbols and benchmark and offers an explicit refresh', async () => {
    const refresh = vi.fn();
    const { user, rerender } = renderWithProviders(<ResultQualitySummary result={{ ...result,
      benchmarkTicker: 'SPY', benchmarkLastBar: '2026-10-12',
      candidates: [{ ticker: 'TEST', dataStatus: 'stale', dataAsOf: '2026-10-13' }] as ScreenerResponse['candidates'],
    }} isRefreshing={false} error={null} onRefresh={refresh} />);
    openNativeDisclosure(screen.getByText(t('cockpit.review.scanDetails')));
    expect(screen.getByText(t('screener.quality.staleInput', { symbol: 'TEST', date: '2026-10-13' }))).toBeVisible();
    expect(screen.getByText(t('screener.quality.staleInput', { symbol: 'SPY', date: '2026-10-12' }))).toBeVisible();
    await user.click(screen.getByRole('button', { name: t('todayPage.refresh.action') }));
    expect(refresh).toHaveBeenCalledOnce();
    rerender(<ResultQualitySummary result={{ ...result, dataFreshness: 'stale' }} isRefreshing error={null} onRefresh={refresh} />);
    expect(screen.getByText(t('screener.quality.staleUnattributed'))).toBeVisible();
    expect(screen.getByRole('button', { name: t('todayPage.refresh.running') })).toBeDisabled();
  });
  it.each(['final_close', 'intraday', 'stale'] as const)('separates %s data from request completion', (dataFreshness) => {
    renderWithProviders(<ResultQualitySummary result={{ ...result, dataFreshness }} completedAt="2026-10-15T10:00:00Z" isRefreshing={false} error={null} />);
    expect(screen.getByText(t('screener.quality.complete'))).toBeVisible();
    expect(screen.getByText(t(`screener.quality.market.${dataFreshness}`))).toBeVisible();
    openNativeDisclosure(screen.getByText(t('cockpit.review.scanDetails')));
    expect(screen.getByText(t('screener.quality.candleDate', { date: '2026-10-14' }))).toBeVisible();
  });
  it('distinguishes initial loading from unavailable and empty success', () => {
    const { rerender } = renderWithProviders(<ResultQualitySummary result={null} isRefreshing error={null} />);
    expect(screen.getByText(t('screener.quality.initialLoading'))).toBeVisible();
    rerender(<ResultQualitySummary result={null} isRefreshing={false} error={new Error('failure')} />);
    expect(screen.getByText(t('screener.quality.unavailable'))).toBeVisible();
    rerender(<ResultQualitySummary result={{ ...result, totalScreened: 0, totalWithMarketData: 0 }} isRefreshing={false} error={null} />);
    expect(screen.getByText(t('screener.quality.empty'))).toBeVisible();
  });
  it('labels retained results during refresh and keeps metadata after remount', () => {
    const { unmount } = renderWithProviders(<ResultQualitySummary result={result} isRefreshing error={null} />);
    expect(screen.getByText(t('screener.quality.previousWhileRefreshing'))).toBeVisible();
    unmount();
    renderWithProviders(<ResultQualitySummary result={result} isRefreshing={false} error={null} />);
    openNativeDisclosure(screen.getByText(t('cockpit.review.scanDetails')));
    expect(screen.getByText(t('screener.quality.counts', { requested: 4, evaluated: 4, matched: 0 }))).toBeVisible();
  });
  it('does not fabricate missing legacy coverage or dates', () => {
    renderWithProviders(<ResultQualitySummary result={{ ...result, totalWithMarketData: undefined, benchmarkLastBar: undefined }} isRefreshing={false} error={null} />);
    expect(screen.getByText(t('screener.quality.coverageUnavailable'))).toBeVisible();
    openNativeDisclosure(screen.getByText(t('cockpit.review.scanDetails')));
    expect(screen.getByText(t('screener.quality.candleDate', { date: t('screener.quality.unknownDate') }))).toBeVisible();
  });
});
