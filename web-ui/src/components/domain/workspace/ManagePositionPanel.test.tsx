import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import ManagePositionPanel from './ManagePositionPanel';

const position = {
  positionId: 'POS-1', ticker: 'LRCX', entryPrice: 383.04, stopPrice: 346.3,
  targetPrice: 498.26, shares: 2, perShareRisk: 36.74, rNow: 0.51, daysOpen: 10,
  pnl: 0, pnlPercent: 0, entryValue: 766.08, currentValue: 803.64, totalRisk: 73.48,
  feesEur: 0, rFxAdjusted: null, timeStopWarning: false, trailMethod: 'sma20', trailParam: null,
} as any;

describe('ManagePositionPanel', () => {
  it('renders manage actions and no create-entry / setup-fails copy', () => {
    renderWithProviders(<ManagePositionPanel position={position} candidate={null} />);
    expect(screen.getByText(t('workspacePage.panels.analysis.managePosition.title'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.updateStop') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.scaleOut') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.exit') })).toBeInTheDocument();
  });

  it('hides Add-to-position when no actionable entry signal', () => {
    renderWithProviders(<ManagePositionPanel position={position} candidate={null} />);
    expect(screen.queryByRole('button', { name: t('workspacePage.panels.analysis.managePosition.add') })).not.toBeInTheDocument();
  });

  it('shows Add-to-position only on an actionable entry signal', () => {
    const candidate = { decisionSummary: { action: 'BUY_ON_PULLBACK' } } as any;
    renderWithProviders(<ManagePositionPanel position={position} candidate={candidate} />);
    expect(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.add') })).toBeInTheDocument();
  });

  it('calls onPrepareOrder when Add button is clicked', async () => {
    const onPrepareOrder = vi.fn();
    const candidate = { decisionSummary: { action: 'BUY_ON_PULLBACK' } } as any;
    renderWithProviders(<ManagePositionPanel position={position} candidate={candidate} onPrepareOrder={onPrepareOrder} />);
    await userEvent.click(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.add') }));
    expect(onPrepareOrder).toHaveBeenCalledOnce();
  });

  it('opens the update-stop modal on click', async () => {
    renderWithProviders(<ManagePositionPanel position={position} candidate={null} />);
    await userEvent.click(screen.getByRole('button', { name: t('workspacePage.panels.analysis.managePosition.updateStop') }));
    expect(screen.getByText(t('positions.updateStopModal.title', { ticker: 'LRCX' }))).toBeInTheDocument();
  });
});
