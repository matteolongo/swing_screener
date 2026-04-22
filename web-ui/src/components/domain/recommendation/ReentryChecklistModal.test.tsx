import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import ReentryChecklistModal from './ReentryChecklistModal';
import type { PriorTradeContext, ReentryGateResult } from '@/features/screener/types';
import { t } from '@/i18n/t';

const priorTrades: PriorTradeContext = {
  lastExitDate: '2026-03-01',
  lastExitPrice: 95,
  lastEntryPrice: 100,
  lastROutcome: -1.0,
  wasProfitable: false,
  tradeCount: 1,
};

const reentryGate: ReentryGateResult = {
  suppressed: false,
  checks: {
    thesis_valid: { passed: true, reason: 'RECOMMENDED.' },
    new_setup_present: { passed: true, reason: 'Structural.' },
    stop_defined: { passed: true, reason: 'Structural.' },
    reward_sufficient: { passed: true, reason: 'R/R 2.5 >= 2.0.' },
    position_size_reset: { passed: true, reason: 'Structural.' },
    timeframe_fits: { passed: true, reason: 'Structural.' },
    market_context_clean: { passed: true, reason: 'No upcoming earnings.' },
  },
};

describe('ReentryChecklistModal', () => {
  it('renders ticker and prior trade summary', () => {
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={reentryGate}
        onProceed={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText(t('reentryChecklist.title', { ticker: 'AAPL' }))).toBeInTheDocument();
    expect(screen.getByText('\u22121.0R')).toBeInTheDocument();
  });

  it('proceed button is disabled until manual checkbox is ticked', () => {
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={reentryGate}
        onProceed={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    const proceed = screen.getByRole('button', { name: t('reentryChecklist.proceedButton') });
    expect(proceed).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(proceed).toBeEnabled();
  });

  it('calls onProceed when proceed is clicked after checkbox', () => {
    const onProceed = vi.fn();
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={reentryGate}
        onProceed={onProceed}
        onSkip={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: t('reentryChecklist.proceedButton') }));
    expect(onProceed).toHaveBeenCalledOnce();
  });

  it('calls onSkip when skip button is clicked', () => {
    const onSkip = vi.fn();
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={reentryGate}
        onProceed={vi.fn()}
        onSkip={onSkip}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: t('reentryChecklist.skipButton') }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('shows stop-out warning when last trade was a loss', () => {
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={{ ...priorTrades, wasProfitable: false }}
        reentryGate={reentryGate}
        onProceed={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText(t('reentryChecklist.stopOutWarning'))).toBeInTheDocument();
  });

  it('does not show stop-out warning when last trade was profitable', () => {
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={{ ...priorTrades, wasProfitable: true }}
        reentryGate={reentryGate}
        onProceed={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.queryByText(t('reentryChecklist.stopOutWarning'))).not.toBeInTheDocument();
  });

  it('shows failed check with reason text', () => {
    const gateWithFail: ReentryGateResult = {
      suppressed: false,
      checks: {
        ...reentryGate.checks,
        reward_sufficient: { passed: false, reason: 'R/R 1.5 is below threshold 2.0.' },
      },
    };
    renderWithProviders(
      <ReentryChecklistModal
        ticker="AAPL"
        priorTrades={priorTrades}
        reentryGate={gateWithFail}
        onProceed={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(screen.getByText(/R\/R 1\.5 is below threshold/)).toBeInTheDocument();
  });
});
