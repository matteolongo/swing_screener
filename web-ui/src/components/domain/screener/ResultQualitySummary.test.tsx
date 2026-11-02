import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import type { ScreenerResponse } from '@/features/screener/types';
import ResultQualitySummary from './ResultQualitySummary';

const result: ScreenerResponse = { asofDate: '2026-10-14', totalScreened: 4, totalWithMarketData: 4,
  dataFreshness: 'final_close', candidates: [], benchmarkLastBar: '2026-10-14' };

describe('ResultQualitySummary', () => {
  it.each(['final_close', 'intraday', 'stale'] as const)('separates %s data from request completion', (dataFreshness) => {
    renderWithProviders(<ResultQualitySummary result={{ ...result, dataFreshness }} completedAt="2026-10-15T10:00:00Z" isRefreshing={false} error={null} />);
    expect(screen.getByText(t('screener.quality.complete'))).toBeVisible();
    expect(screen.getByText(t(`screener.quality.market.${dataFreshness}`))).toBeVisible();
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
    expect(screen.getByText(t('screener.quality.counts', { requested: 4, evaluated: 4, matched: 0 }))).toBeVisible();
  });
  it('does not fabricate missing legacy coverage or dates', () => {
    renderWithProviders(<ResultQualitySummary result={{ ...result, totalWithMarketData: undefined, benchmarkLastBar: undefined }} isRefreshing={false} error={null} />);
    expect(screen.getByText(t('screener.quality.coverageUnavailable'))).toBeVisible();
    expect(screen.getByText(t('screener.quality.candleDate', { date: t('screener.quality.unknownDate') }))).toBeVisible();
  });
});
