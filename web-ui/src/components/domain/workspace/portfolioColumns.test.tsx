import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildPortfolioColumns } from './portfolioColumns';
import { t } from '@/i18n/t';

function renderActions() {
  const actions = {
    onCheckLive: () => {}, onUpdateStop: () => {}, onAnalyze: () => {}, onAddOnEntry: () => {},
    onPartialClose: () => {}, onClosePosition: () => {}, onFillOrder: () => {}, onCancelOrder: () => {},
    cancelPending: false, fillPending: false,
  };
  const cols = buildPortfolioColumns(actions);
  const actionsCol = cols.find((c) => c.key === 'actions')!;
  const row = { ticker: 'LRCX', status: 'open', position: { positionId: 'POS-1', ticker: 'LRCX' } } as any;
  return render(<>{actionsCol.render!(row)}</>);
}

describe('portfolio columns actions', () => {
  it('shows Update Stop and Check live', () => {
    renderActions();
    expect(screen.getByRole('button', { name: t('positionsPage.updateStop') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('workspacePage.panels.portfolio.intradayPreview.checkLive') })).toBeInTheDocument();
  });

  it('does not offer Scale out / Add-on / Close in the row', async () => {
    renderActions();
    // open the overflow if present
    const overflow = screen.queryByRole('button', { name: /more|⋯|\.\.\./i });
    if (overflow) await userEvent.click(overflow);
    expect(screen.queryByText(t('positions.partialCloseModal.submit'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('positionsPage.closePosition'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('workspacePage.panels.portfolio.addOnEntry'))).not.toBeInTheDocument();
  });
});

function renderPrices(position: Record<string, unknown>, currentPrice: number) {
  const cols = buildPortfolioColumns({
    onCheckLive: () => {}, onUpdateStop: () => {}, onAnalyze: () => {}, onAddOnEntry: () => {},
    onPartialClose: () => {}, onClosePosition: () => {}, onFillOrder: () => {}, onCancelOrder: () => {},
    cancelPending: false, fillPending: false,
  });
  const pricesCol = cols.find((c) => c.key === 'entry')!;
  const row = {
    ticker: 'LRCX', status: 'open', entryPrice: 100, currentPrice, stopLoss: 95,
    position: { positionId: 'POS-1', ticker: 'LRCX', rUsesInitialRisk: false, ...position },
  } as any;
  return render(<>{pricesCol.render!(row)}</>);
}

describe('portfolio columns prices', () => {
  it('flags an unpriced position even though its price equals the entry', () => {
    renderPrices({ priceSource: 'entry' }, 100);
    expect(screen.getByText(t('workspacePage.panels.portfolio.columns.now'))).toBeInTheDocument();
    expect(screen.getByText(t('positions.priceUnavailable'))).toHaveAttribute('title', t('positions.priceUnavailableTooltip'));
  });

  it('marks a cached price as stale and leaves a live quote unflagged', () => {
    const { unmount } = renderPrices({ priceSource: 'cached' }, 110);
    expect(screen.getByText(t('positions.priceStale'))).toBeInTheDocument();
    unmount();
    renderPrices({ priceSource: 'live' }, 110);
    expect(screen.queryByText(t('positions.priceStale'))).not.toBeInTheDocument();
    expect(screen.queryByText(t('positions.priceUnavailable'))).not.toBeInTheDocument();
  });
});
