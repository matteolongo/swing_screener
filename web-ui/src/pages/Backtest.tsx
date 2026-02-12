import { useMemo, useState } from 'react';
import { AlertCircle, BarChart3, RefreshCw, Trash2 } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useConfigStore } from '@/stores/configStore';
import { FullBacktestResponse, FullEntryType } from '@/features/backtest/types';
import {
  useBacktestSimulations,
  useRunBacktestMutation,
  useLoadSimulation,
  useDeleteSimulationMutation,
} from '@/features/backtest/hooks';
import { useBacktestForm } from '@/features/backtest/useBacktestForm';
import { formatDateTime, formatPercent, formatR, formatCurrency } from '@/utils/formatters';
import EquityCurveChart from '@/components/domain/backtest/EquityCurveChart';
import BacktestTickerSummaryTable from '@/components/domain/backtest/BacktestTickerSummaryTable';
import BacktestTradesTable from '@/components/domain/backtest/BacktestTradesTable';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';

const DEFAULT_LIVE_GAPS = [
  'Backtests assume next-bar entries; live fills can be worse.',
  'Stops can slip beyond planned levels during gaps or fast moves.',
  'Liquidity and order queue priority are simplified in backtests.',
  'Historical data can be revised or survivorship-biased.',
];

export default function Backtest() {
  const { config } = useConfigStore();
  const activeStrategyQuery = useActiveStrategyQuery();

  const {
    formState,
    setFormState,
    canRun,
    presets,
    resetToSettings,
    buildRunParams,
  } = useBacktestForm({
    config,
    strategyKAtr: activeStrategyQuery.data?.risk.kAtr,
  });
  const [loadedResult, setLoadedResult] = useState<FullBacktestResponse | null>(null);

  const simulationsQuery = useBacktestSimulations();

  const runMutation = useRunBacktestMutation();

  const loadSimulationMutation = useLoadSimulation();
  const deleteSimulationMutation = useDeleteSimulationMutation();

  const handleLoadSimulation = async (id: string) => {
    let sim;
    try {
      sim = await loadSimulationMutation.mutateAsync(id);
    } catch {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      tickersText: sim.params.tickers.join(', '),
      start: sim.params.start,
      end: sim.params.end,
      investedBudget: sim.params.investedBudget ?? null,
      entryType: sim.params.entryType,
      breakoutLookback: sim.params.breakoutLookback,
      pullbackMa: sim.params.pullbackMa,
      minHistory: sim.params.minHistory,
      atrWindow: sim.params.atrWindow,
      kAtr: sim.params.kAtr,
      breakevenAtR: sim.params.breakevenAtR,
      trailAfterR: sim.params.trailAfterR,
      trailSma: sim.params.trailSma,
      smaBufferPct: sim.params.smaBufferPct,
      maxHoldingDays: sim.params.maxHoldingDays,
      commissionPct: sim.params.commissionPct,
    }));
    runMutation.reset();
    setLoadedResult(sim.result);
  };

  const handleDeleteSimulation = async (id: string) => {
    deleteSimulationMutation.mutate(id);
  };

  const result = runMutation.data ?? loadedResult;

  const liveCaveats = useMemo(() => {
    if (result?.education?.caveats?.length) return result.education.caveats;
    return DEFAULT_LIVE_GAPS;
  }, [result]);

  const summaryCards = useMemo(() => {
    if (!result) return [];
    const s = result.summary;
    return [
      { label: 'Trades', value: s.trades.toString() },
      { label: 'Expectancy', value: s.expectancyR != null ? formatR(s.expectancyR) : '—' },
      { label: 'Win Rate', value: s.winrate != null ? formatPercent(s.winrate * 100) : '—' },
      { label: 'Profit Factor', value: s.profitFactorR != null ? s.profitFactorR.toFixed(2) : '—' },
      { label: 'Avg Win', value: s.avgWinR != null ? formatR(s.avgWinR) : '—' },
      { label: 'Avg Loss', value: s.avgLossR != null ? formatR(s.avgLossR) : '—' },
      {
        label: 'Trades/Year',
        value: s.tradeFrequencyPerYear != null ? s.tradeFrequencyPerYear.toFixed(1) : '—',
      },
      { label: 'Max Drawdown', value: s.maxDrawdownR != null ? formatR(s.maxDrawdownR) : '—' },
      { label: 'Avg R', value: s.avgR != null ? formatR(s.avgR) : '—' },
    ];
  }, [result]);

  const budgetCards = useMemo(() => {
    if (!result || !formState.investedBudget) return [];
    const riskPct = activeStrategyQuery.data?.risk.riskPct ?? config.risk.riskPct;
    if (!riskPct || riskPct <= 0) return [];
    const riskPerR = formState.investedBudget * riskPct;
    const s = result.summary;
    const formatMoney = (val: number | null) =>
      val == null ? '—' : formatCurrency(val * riskPerR);
    return [
      { label: 'Expectancy $', value: formatMoney(s.expectancyR) },
      { label: 'Avg R $', value: formatMoney(s.avgR) },
      { label: 'Max Drawdown $', value: formatMoney(s.maxDrawdownR != null ? -Math.abs(s.maxDrawdownR) : null) },
      { label: 'Best Trade $', value: formatMoney(s.bestTradeR) },
      { label: 'Worst Trade $', value: formatMoney(s.worstTradeR) },
    ];
  }, [result, formState.investedBudget, activeStrategyQuery.data, config.risk.riskPct]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Backtest</h1>
        <p className="mt-2 text-gray-600">Run full backtests and review saved simulations.</p>
      </div>

      <Card variant="bordered">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Backtest Parameters</CardTitle>
            <p className="text-sm text-gray-500">
              Defaults come from Settings and the active Strategy. Changes are stored locally.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetToSettings}>
              Reset to Settings
            </Button>
            <Button onClick={() => runMutation.mutate(buildRunParams())} disabled={runMutation.isPending || !canRun}>
              {runMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Run Backtest
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tickers (comma-separated)</label>
              <input
                type="text"
                value={formState.tickersText}
                onChange={(e) => setFormState((prev) => ({ ...prev, tickersText: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                placeholder="AAPL, MSFT, NVDA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start</label>
              <input
                type="date"
                value={formState.start}
                onChange={(e) => setFormState((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End</label>
              <input
                type="date"
                value={formState.end}
                onChange={(e) => setFormState((prev) => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="investedBudget" className="block text-sm font-medium mb-1">
                Invested Budget (optional)
              </label>
              <input
                id="investedBudget"
                type="number"
                min="0"
                step="1"
                value={formState.investedBudget ?? ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setFormState((prev) => ({
                    ...prev,
                    investedBudget: value === '' ? null : Number(value),
                  }));
                }}
                className="w-full px-3 py-2 border border-border rounded-lg"
                placeholder="e.g. 10000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Converts R results to $ using the active strategy risk %.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="text-gray-500">Presets:</span>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                size="sm"
                variant="secondary"
                onClick={() => {
                  const range = preset.range();
                  setFormState((prev) => ({ ...prev, start: range.start, end: range.end }));
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Entry Type</label>
              <select
                value={formState.entryType}
                onChange={(e) => setFormState((prev) => ({ ...prev, entryType: e.target.value as FullEntryType }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              >
                <option value="auto">Auto (Breakout or Pullback)</option>
                <option value="breakout">Breakout Only</option>
                <option value="pullback">Pullback Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Breakout Lookback</label>
              <input
                type="number"
                value={formState.breakoutLookback}
                onChange={(e) => setFormState((prev) => ({ ...prev, breakoutLookback: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                min="10"
                max="200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pullback MA</label>
              <input
                type="number"
                value={formState.pullbackMa}
                onChange={(e) => setFormState((prev) => ({ ...prev, pullbackMa: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                min="5"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min History</label>
              <input
                type="number"
                value={formState.minHistory}
                onChange={(e) => setFormState((prev) => ({ ...prev, minHistory: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                min="50"
                max="500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">ATR Window</label>
              <input
                type="number"
                value={formState.atrWindow}
                onChange={(e) => setFormState((prev) => ({ ...prev, atrWindow: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">k×ATR Stop</label>
              <input
                type="number"
                value={formState.kAtr}
                onChange={(e) => setFormState((prev) => ({ ...prev, kAtr: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Commission (%)</label>
              <input
                type="number"
                value={formState.commissionPct * 100}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, commissionPct: Number(e.target.value) / 100 }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Breakeven At R</label>
              <input
                type="number"
                value={formState.breakevenAtR}
                onChange={(e) => setFormState((prev) => ({ ...prev, breakevenAtR: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Trail After R</label>
              <input
                type="number"
                value={formState.trailAfterR}
                onChange={(e) => setFormState((prev) => ({ ...prev, trailAfterR: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Trail SMA</label>
              <input
                type="number"
                value={formState.trailSma}
                onChange={(e) => setFormState((prev) => ({ ...prev, trailSma: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">SMA Buffer (%)</label>
              <input
                type="number"
                value={formState.smaBufferPct * 100}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, smaBufferPct: Number(e.target.value) / 100 }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg"
                step="0.1"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Max Holding Days</label>
              <input
                type="number"
                value={formState.maxHoldingDays}
                onChange={(e) => setFormState((prev) => ({ ...prev, maxHoldingDays: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {runMutation.isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          Error: {runMutation.error.message}
        </div>
      )}

      {result?.warnings?.length ? (
        <div className="space-y-2">
          {result.warnings.map((w, i) => (
            <div key={i} className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {summaryCards.map((item) => (
                      <div key={item.label} className="p-3 bg-gray-50 rounded">
                        <div className="text-xs text-gray-600">{item.label}</div>
                        <div className="text-lg font-semibold">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  {budgetCards.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {budgetCards.map((item) => (
                        <div key={item.label} className="p-3 bg-blue-50 rounded">
                          <div className="text-xs text-blue-700">{item.label}</div>
                          <div className="text-lg font-semibold text-blue-900">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Run a backtest to see summary metrics.</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Cost Impact</CardTitle>
            </CardHeader>
            <CardContent>
              {result?.costs ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Commission</div>
                    <div className="text-lg font-semibold">{formatPercent(result.costs.commissionPct * 100)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Slippage (bps)</div>
                    <div className="text-lg font-semibold">{result.costs.slippageBps.toFixed(1)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">FX Cost</div>
                    <div className="text-lg font-semibold">{formatPercent(result.costs.fxPct * 100)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Avg Cost (R)</div>
                    <div className="text-lg font-semibold">
                      {result.costs.avgCostR != null ? formatR(result.costs.avgCostR) : '—'}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Total Cost (R)</div>
                    <div className="text-lg font-semibold">
                      {result.costs.totalCostR != null ? formatR(result.costs.totalCostR) : '—'}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Gross R (total)</div>
                    <div className="text-lg font-semibold">
                      {result.costs.grossRTotal != null ? formatR(result.costs.grossRTotal) : '—'}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Net R (total)</div>
                    <div className="text-lg font-semibold">
                      {result.costs.netRTotal != null ? formatR(result.costs.netRTotal) : '—'}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">Fee Impact</div>
                    <div className="text-lg font-semibold">
                      {result.costs.feeImpactPct != null ? formatPercent(result.costs.feeImpactPct * 100, 1) : '—'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Run a backtest to see cost impact.</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>RR Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {result?.summary.rrDistribution && Object.keys(result.summary.rrDistribution).length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {Object.entries(result.summary.rrDistribution).map(([label, count]) => (
                    <div key={label} className="p-3 bg-gray-50 rounded">
                      <div className="text-xs text-gray-600">{label}</div>
                      <div className="text-lg font-semibold">{count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Run a backtest to see RR distribution.</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Education Report</CardTitle>
            </CardHeader>
            <CardContent>
              {result?.education ? (
                <div className="space-y-3 text-sm">
                  <div className="text-gray-700">{result.education.overview}</div>
                  {result.education.drivers.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500">Key Drivers</div>
                      <ul className="list-disc ml-5 mt-1 space-y-1">
                        {result.education.drivers.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.education.caveats.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500">Caveats</div>
                      <ul className="list-disc ml-5 mt-1 space-y-1">
                        {result.education.caveats.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Run a backtest to see education notes.</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Why Backtests Differ From Live</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc ml-5 space-y-2 text-sm text-gray-700">
                {liveCaveats.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Equity Curve (R)</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <EquityCurveChart total={result.curveTotal} byTicker={result.curveByTicker} />
              ) : (
                <div className="text-sm text-gray-500">No curve to display yet.</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Summary by Ticker</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <BacktestTickerSummaryTable rows={result.summaryByTicker} />
              ) : (
                <div className="text-sm text-gray-500">No ticker-level summary available.</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Trades</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <BacktestTradesTable rows={result.trades} />
              ) : (
                <div className="text-sm text-gray-500">No trades generated.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Saved Simulations</CardTitle>
            </CardHeader>
            <CardContent>
              {simulationsQuery.isLoading && <div className="text-sm text-gray-500">Loading...</div>}
              {simulationsQuery.data && simulationsQuery.data.length === 0 && (
                <div className="text-sm text-gray-500">No saved simulations yet.</div>
              )}
              <div className="space-y-3">
                {simulationsQuery.data?.map((sim) => (
                  <div key={sim.id} className="border border-border rounded-lg p-3">
                    <div className="text-sm font-semibold">{sim.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDateTime(sim.createdAt)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {sim.trades ?? 0} trades
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="secondary" onClick={() => handleLoadSimulation(sim.id)}>
                        Load
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleDeleteSimulation(sim.id)}>
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
