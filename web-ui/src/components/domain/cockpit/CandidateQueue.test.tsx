import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import CandidateQueue from './CandidateQueue';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { ScreenerResponse } from '@/features/screener/types';

function seedQueue() {
  useWorkspaceStore.setState({ selection: null, selectedTicker: null });
  useScreenerStore.setState({
    todayRun: null,
    lastRunContext: null,
    todayRunInitialized: true,
    lastResult: {
      asofDate: '2026-09-16',
      totalScreened: 4,
      dataFreshness: 'final_close',
      candidates: [
        {
          ticker: 'HEIA',
          name: 'Heineken N.V.',
          currency: 'EUR',
          close: 90,
          sma20: null,
          sma50: null,
          sma200: null,
          atr: 1.5,
          momentum6m: 0,
          momentum12m: 0,
          relStrength: 0,
          score: 0.2,
          confidence: 30,
          rank: 4,
          technicalRank: 4,
          priorityRank: 4,
          recommendation: {
            verdict: 'NOT_RECOMMENDED',
            workflowStatus: 'no_setup',
            nextStep: { code: 'observe' },
          },
        },
        {
          ticker: 'STM',
          name: 'STMicroelectronics N.V.',
          currency: 'EUR',
          close: 25,
          sma20: null,
          sma50: null,
          sma200: null,
          atr: 0.8,
          momentum6m: 0,
          momentum12m: 0,
          relStrength: 0,
          score: 0.5,
          confidence: 50,
          rank: 3,
          technicalRank: 3,
          priorityRank: 3,
          rr: 0.8,
          recommendation: {
            verdict: 'NOT_RECOMMENDED',
            workflowStatus: 'needs_review',
            nextStep: { code: 'define_target' },
          },
        },
        {
          ticker: 'ASML',
          name: 'ASML Holding N.V.',
          currency: 'EUR',
          close: 700,
          sma20: null,
          sma50: null,
          sma200: null,
          atr: 15,
          momentum6m: 0,
          momentum12m: 0,
          relStrength: 0,
          score: 0.8,
          confidence: 70,
          rank: 2,
          technicalRank: 2,
          priorityRank: 2,
          rr: 2,
          executionEligibility: { allowed: true, mode: 'pending_pullback', reason: null },
          canonicalOrderDraft: {
            orderType: 'BUY_LIMIT',
            entry: 690,
            stop: 655,
            target: 760,
            shares: 3,
            rr: 2,
            quoteCurrency: 'EUR',
            approvalToken: 'tok-asml-1',
          },
          recommendation: {
            verdict: 'NOT_RECOMMENDED',
            workflowStatus: 'waiting_trigger',
            nextStep: { code: 'wait_pullback', triggerPrice: 690, currency: 'EUR' },
          },
        },
        {
          ticker: 'adyen',
          name: 'Adyen N.V.',
          currency: 'EUR',
          close: 1400,
          sma20: null,
          sma50: null,
          sma200: null,
          atr: 25,
          momentum6m: 0,
          momentum12m: 0,
          relStrength: 0,
          score: 0.9,
          confidence: 90,
          rank: 1,
          technicalRank: 1,
          priorityRank: 1,
          rr: 2,
          executionEligibility: { allowed: true, mode: 'ready', reason: null },
          canonicalOrderDraft: {
            orderType: 'BUY_LIMIT',
            entry: 1400,
            stop: 1330,
            target: 1540,
            shares: 2,
            rr: 2,
            quoteCurrency: 'EUR',
            approvalToken: 'tok-adyen-1',
          },
          recommendation: {
            verdict: 'RECOMMENDED',
            workflowStatus: 'ready',
            nextStep: { code: 'review_order' },
          },
        },
      ],
    } as unknown as ScreenerResponse,
  });
}

describe('CandidateQueue', () => {
  beforeEach(() => {
    seedQueue();
  });

  it('renders groups in backend order with no-setup collapsed', () => {
    renderWithProviders(<CandidateQueue onSelectTicker={() => {}} />);
    const groups = screen.getAllByRole('heading', { level: 3 });
    expect(groups.map((g) => g.textContent)).toEqual([
      expect.stringContaining(t('cockpit.queue.ready')),
      expect.stringContaining(t('cockpit.queue.waiting')),
      expect.stringContaining(t('cockpit.queue.needsReview')),
    ]);
    expect(screen.getByRole('button', { name: t('cockpit.queue.showNoSetup') })).toBeInTheDocument();
  });

  it('shows review button only for eligible candidates with a valid draft', () => {
    renderWithProviders(<CandidateQueue onSelectTicker={() => {}} />);
    expect(screen.getByRole('button', { name: `${t('cockpit.queue.reviewOrder')} ADYEN` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `${t('cockpit.queue.reviewOrder')} STM` })).not.toBeInTheDocument();
  });

  it('exposes the candidate-queue hook and emits normalized uppercase tickers', async () => {
    const seen: string[] = [];
    const { user } = renderWithProviders(
      <CandidateQueue onSelectTicker={(ticker) => { seen.push(ticker); }} />,
    );
    expect(screen.getByTestId('candidate-queue')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `${t('cockpit.queue.details')} ADYEN` }));
    expect(seen).toEqual(['ADYEN']);
  });
});
