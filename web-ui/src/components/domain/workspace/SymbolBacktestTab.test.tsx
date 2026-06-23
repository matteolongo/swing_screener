import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/mocks/server';
import { renderWithProviders, screen, waitFor } from '@/test/utils';
import { t } from '@/i18n/t';
import SymbolBacktestTab from './SymbolBacktestTab';

function resultFor(ticker: string) {
  return {
    tickers: [ticker],
    start: '2022-01-01',
    end: '2022-02-01',
    config_used: {},
    trades: [
      {
        ticker,
        setup: 'breakout',
        entry_date: '2022-01-10',
        entry_price: 110,
        initial_stop: 104.57,
        initial_risk: 5.43,
        target: 120.86,
        exit_date: '2022-01-11',
        exit_price: 104.57,
        exit_reason: 'stop_hit',
        r_multiple: -1,
        bars_held: 1,
        mfe_r: 0,
        mae_r: -3.68,
        pattern_stop_fired: false,
      },
    ],
    metrics: {
      n_trades: 1,
      win_rate: 0,
      expectancy_r: -1,
      total_r: -1,
      profit_factor: null,
      avg_win_r: 0,
      avg_loss_r: -1,
      avg_bars_held: 1,
      max_drawdown_r: 1,
      exit_reason_counts: { stop_hit: 1 },
      by_setup: {},
    },
  };
}

describe('SymbolBacktestTab', () => {
  it('runs an event study for the locked ticker and renders results', async () => {
    let postedTickers: string[] = [];
    server.use(
      http.post('*/api/backtest/event-study', async ({ request }) => {
        const body = (await request.json()) as { tickers: string[] };
        postedTickers = body.tickers;
        return HttpResponse.json(resultFor('AAPL'), { status: 200 });
      }),
    );

    const { user } = renderWithProviders(<SymbolBacktestTab ticker="AAPL" />);

    await user.click(screen.getByRole('button', { name: t('backtest.form.run') }));

    expect(await screen.findByText(t('backtest.results.title'))).toBeInTheDocument();
    expect(screen.getByText(t('backtest.metrics.expectancy'))).toBeInTheDocument();
    expect(postedTickers).toEqual(['AAPL']);
  });

  it('clears stale results when the symbol changes', async () => {
    server.use(
      http.post('*/api/backtest/event-study', () => HttpResponse.json(resultFor('AAPL'), { status: 200 })),
    );

    const { user, rerender } = renderWithProviders(<SymbolBacktestTab ticker="AAPL" />);
    await user.click(screen.getByRole('button', { name: t('backtest.form.run') }));
    expect(await screen.findByText(t('backtest.results.title'))).toBeInTheDocument();

    rerender(<SymbolBacktestTab ticker="MSFT" />);

    await waitFor(() =>
      expect(screen.queryByText(t('backtest.results.title'))).not.toBeInTheDocument(),
    );
  });
});
