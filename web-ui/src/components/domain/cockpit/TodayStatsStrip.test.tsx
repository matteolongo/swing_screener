import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import TodayStatsStrip from './TodayStatsStrip';
import { useScreenerStore } from '@/stores/screenerStore';
import type { ScreenerResponse } from '@/features/screener/types';

describe('TodayStatsStrip', () => {
  beforeEach(() => {
    useScreenerStore.setState({
      todayRun: null,
      lastRunContext: null,
      todayRunInitialized: true,
      lastResult: {
        asofDate: '2026-07-10',
        candidates: [
          {
            ticker: 'READY',
            currency: 'USD',
            close: 100,
            sma20: null,
            sma50: null,
            sma200: null,
            atr: 1,
            momentum6m: 0,
            momentum12m: 0,
            relStrength: 0,
            score: 1,
            confidence: 90,
            rank: 1,
            rr: 2,
            recommendation: {
              verdict: 'RECOMMENDED',
              workflowStatus: 'ready',
              nextStep: { code: 'review_order' },
            },
          },
          {
            ticker: 'WAITING',
            currency: 'USD',
            close: 50,
            sma20: null,
            sma50: null,
            sma200: null,
            atr: 1,
            momentum6m: 0,
            momentum12m: 0,
            relStrength: 0,
            score: 0.5,
            confidence: 40,
            rank: 2,
            rr: 1.5,
            recommendation: {
              verdict: 'NOT_RECOMMENDED',
              workflowStatus: 'waiting_trigger',
              nextStep: { code: 'observe' },
            },
          },
        ],
        totalScreened: 2,
        dataFreshness: 'final_close',
      } as unknown as ScreenerResponse,
    });
  });

  it('shows positions, pending orders, ready count and final_close state', () => {
    renderWithProviders(<TodayStatsStrip />);
    expect(screen.getByText(t('cockpit.strip.positions'))).toBeInTheDocument();
    expect(screen.getByText(t('cockpit.strip.pendingOrders'))).toBeInTheDocument();
    expect(screen.getByText(t('cockpit.strip.ready'))).toBeInTheDocument();
    expect(screen.getByText(t('cockpit.strip.finalClose'))).toBeInTheDocument();
  });
});
