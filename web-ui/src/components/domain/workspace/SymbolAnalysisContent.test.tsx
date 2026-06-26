import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import SymbolAnalysisContent from './SymbolAnalysisContent';

const position = {
  positionId: 'POS-1', ticker: 'LRCX', entryPrice: 383.04, stopPrice: 346.3, targetPrice: 498.26,
  shares: 2, perShareRisk: 36.74, rNow: 0.51, daysOpen: 10, pnl: 0, pnlPercent: 0,
  entryValue: 766.08, currentValue: 803.64, totalRisk: 73.48, feesEur: 0, rFxAdjusted: null,
  timeStopWarning: false, trailMethod: 'sma20', trailParam: null,
} as any;

describe('SymbolAnalysisContent held mode', () => {
  it('hides the Order tab and folds the manage panel into Overview', () => {
    renderWithProviders(
      <SymbolAnalysisContent ticker="LRCX" candidate={null} position={position} activeTab="overview" onTabChange={() => {}} orderPanel={<div>order</div>} />,
    );
    expect(screen.queryByRole('tab', { name: t('workspacePage.panels.analysis.tabs.order') })).not.toBeInTheDocument();
    expect(screen.getByText(t('workspacePage.panels.analysis.managePosition.title'))).toBeInTheDocument();
  });
});
