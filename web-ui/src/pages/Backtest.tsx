import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, BarChart3, RefreshCw, Trash2 } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { fetchActiveStrategy } from '@/lib/strategyApi';
import { useConfigStore } from '@/stores/configStore';
import {
  BacktestSimulationAPI,
  BacktestSimulationMetaAPI,
  FullBacktestResponseAPI,
  FullEntryType,
  FullBacktestResponse,
  transformBacktestSimulation,
  transformBacktestSimulationMeta,
  transformFullBacktestResponse,
} from '@/types/backtest';
import { formatDateTime, formatPercent, formatR } from '@/utils/formatters';
import EquityCurveChart from '@/components/domain/backtest/EquityCurveChart';

const STORAGE_KEY = 'backtest.params.v1';

interface BacktestFormState {
  tickersText: string;
  start: string;
  end: string;
  entryType: FullEntryType;
  breakoutLookback: number;
  pullbackMa: number;
  minHistory: number;
  atrWindow: number;
  kAtr: number;
  breakevenAtR: number;
  trailAfterR: number;
  trailSma: number;
  smaBufferPct: number;
  maxHoldingDays: number;
  commissionPct: number;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 2);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function buildDefaultFormState(
  config: ReturnType<typeof useConfigStore>['config'],
  overrides?: { kAtr?: number }
): BacktestFormState {
  const { start, end } = defaultDateRange();
  return {
    tickersText: '',
    start,
    end,
    entryType: 'auto',
    breakoutLookback: config.indicators.breakoutLookback,
    pullbackMa: config.indicators.pullbackMa,
    minHistory: config.indicators.minHistory,
    atrWindow: config.indicators.atrWindow,
    kAtr: overrides?.kAtr ?? config.risk.kAtr,
    breakevenAtR: config.manage.breakevenAtR,
    trailAfterR: config.manage.trailAfterR,
    trailSma: config.manage.trailSma,
    smaBufferPct: config.manage.smaBufferPct,
    maxHoldingDays: config.manage.maxHoldingDays,
    commissionPct: 0,
  };
}

function loadFormState(fallback: BacktestFormState): BacktestFormState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<BacktestFormState>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function parseTickers(input: string): string[] {
  return input
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);
}

export default function Backtest() {
  const { config } = useConfigStore();
  const activeStrategyQuery = useQuery({
    queryKey: ['strategy-active'],
    queryFn: fetchActiveStrategy,
  });
  const queryClient = useQueryClient();

  const [formState, setFormState] = useState<BacktestFormState>(() => {
    const defaults = buildDefaultFormState(config, {
      kAtr: activeStrategyQuery.data?.risk.kAtr,
    });
    return loadFormState(defaults);
  });
  const [result, setResult] = useState<FullBacktestResponse | null>(null);
  const canRun = parseTickers(formState.tickersText).length > 0;

  useEffect(() => {
    if (!activeStrategyQuery.data) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const defaults = buildDefaultFormState(config, {
      kAtr: activeStrategyQuery.data.risk.kAtr,
    });
    setFormState(defaults);
  }, [activeStrategyQuery.data, config]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
  }, [formState]);

  const simulationsQuery = useQuery({
    queryKey: ['backtest-simulations'],
    queryFn: async () => {
      const res = await fetch(apiUrl(API_ENDPOINTS.backtestSimulations));
      if (!res.ok) throw new Error('Failed to load simulations');
      const data: BacktestSimulationMetaAPI[] = await res.json();
      return data.map(transformBacktestSimulationMeta);
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const tickers = parseTickers(formState.tickersText);
      const payload = {
        tickers,
        start: formState.start,
        end: formState.end,
        entry_type: formState.entryType,
        breakout_lookback: formState.breakoutLookback,
        pullback_ma: formState.pullbackMa,
        min_history: formState.minHistory,
        atr_window: formState.atrWindow,
        k_atr: formState.kAtr,
        breakeven_at_r: formState.breakevenAtR,
        trail_after_r: formState.trailAfterR,
        trail_sma: formState.trailSma,
        sma_buffer_pct: formState.smaBufferPct,
        max_holding_days: formState.maxHoldingDays,
        commission_pct: formState.commissionPct,
      };

      const res = await fetch(apiUrl(API_ENDPOINTS.backtestRun), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Backtest failed');
      }
      const data: FullBacktestResponseAPI = await res.json();
      return transformFullBacktestResponse(data);
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['backtest-simulations'] });
    },
  });

  const handleResetToSettings = () => {
    const defaults = buildDefaultFormState(config, {
      kAtr: activeStrategyQuery.data?.risk.kAtr,
    });
    setFormState((prev) => ({
      ...prev,
      entryType: defaults.entryType,
      breakoutLookback: defaults.breakoutLookback,
      pullbackMa: defaults.pullbackMa,
      minHistory: defaults.minHistory,
      atrWindow: defaults.atrWindow,
      kAtr: defaults.kAtr,
      breakevenAtR: defaults.breakevenAtR,
      trailAfterR: defaults.trailAfterR,
      trailSma: defaults.trailSma,
      smaBufferPct: defaults.smaBufferPct,
      maxHoldingDays: defaults.maxHoldingDays,
      commissionPct: defaults.commissionPct,
    }));
  };

  const handleLoadSimulation = async (id: string) => {
    const res = await fetch(apiUrl(API_ENDPOINTS.backtestSimulation(id)));
    if (!res.ok) {
      return;
    }
    const data: BacktestSimulationAPI = await res.json();
    const sim = transformBacktestSimulation(data);
    setFormState((prev) => ({
      ...prev,
      tickersText: sim.params.tickers.join(', '),
      start: sim.params.start,
      end: sim.params.end,
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
    setResult(sim.result);
  };

  const handleDeleteSimulation = async (id: string) => {
    const res = await fetch(apiUrl(API_ENDPOINTS.backtestSimulation(id)), { method: 'DELETE' });
    if (!res.ok) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['backtest-simulations'] });
  };

  const summaryCards = useMemo(() => {
    if (!result) return [];
    const s = result.summary;
    return [
      { label: 'Trades', value: s.trades.toString() },
      { label: 'Expectancy', value: s.expectancyR != null ? formatR(s.expectancyR) : '—' },
      { label: 'Win Rate', value: s.winrate != null ? formatPercent(s.winrate * 100) : '—' },
      { label: 'Profit Factor', value: s.profitFactorR != null ? s.profitFactorR.toFixed(2) : '—' },
      { label: 'Max Drawdown', value: s.maxDrawdownR != null ? formatR(s.maxDrawdownR) : '—' },
      { label: 'Avg R', value: s.avgR != null ? formatR(s.avgR) : '—' },
    ];
  }, [result]);

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
            <Button variant="secondary" onClick={handleResetToSettings}>
              Reset to Settings
            </Button>
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending || !canRun}>
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {summaryCards.map((item) => (
                    <div key={item.label} className="p-3 bg-gray-50 rounded">
                      <div className="text-xs text-gray-600">{item.label}</div>
                      <div className="text-lg font-semibold">{item.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Run a backtest to see summary metrics.</div>
              )}
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
              {result && result.summaryByTicker.length > 0 ? (
                <div className="max-h-[260px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="py-2">Ticker</th>
                        <th className="py-2">Trades</th>
                        <th className="py-2">Expectancy</th>
                        <th className="py-2">Win Rate</th>
                        <th className="py-2">Avg R</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.summaryByTicker.map((row) => (
                        <tr key={row.ticker} className="border-t">
                          <td className="py-2 font-medium">{row.ticker}</td>
                          <td className="py-2">{row.trades}</td>
                          <td className="py-2">{row.expectancyR != null ? formatR(row.expectancyR) : '—'}</td>
                          <td className="py-2">
                            {row.winrate != null ? formatPercent(row.winrate * 100) : '—'}
                          </td>
                          <td className="py-2">{row.avgR != null ? formatR(row.avgR) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
              {result && result.trades.length > 0 ? (
                <div className="max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="py-2">Ticker</th>
                        <th className="py-2">Entry</th>
                        <th className="py-2">Exit</th>
                        <th className="py-2">R</th>
                        <th className="py-2">Exit Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => (
                        <tr key={`${t.ticker}-${t.entryDate}-${i}`} className="border-t">
                          <td className="py-2 font-medium">{t.ticker}</td>
                          <td className="py-2">{t.entryDate}</td>
                          <td className="py-2">{t.exitDate}</td>
                          <td className={`py-2 ${t.r >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatR(t.r)}
                          </td>
                          <td className="py-2">{t.exitReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
