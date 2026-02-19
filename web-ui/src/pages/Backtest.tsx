import { useMemo, useState } from 'react';
import { AlertCircle, BarChart3, RefreshCw, Trash2 } from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { FullBacktestResponse, type FullEntryType } from '@/features/backtest/types';
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
import { DEFAULT_CONFIG } from '@/types/config';
import { t } from '@/i18n/t';

export default function Backtest() {
  const activeStrategyQuery = useActiveStrategyQuery();
  const strategy = activeStrategyQuery.data;
  const config = useMemo(() => {
    if (!strategy) return DEFAULT_CONFIG;
    return {
      ...DEFAULT_CONFIG,
      risk: {
        ...DEFAULT_CONFIG.risk,
        ...strategy.risk,
      },
      indicators: {
        ...DEFAULT_CONFIG.indicators,
        smaFast: strategy.universe.trend.smaFast,
        smaMid: strategy.universe.trend.smaMid,
        smaLong: strategy.universe.trend.smaLong,
        atrWindow: strategy.universe.vol.atrWindow,
        lookback6m: strategy.universe.mom.lookback6m,
        lookback12m: strategy.universe.mom.lookback12m,
        benchmark: strategy.universe.mom.benchmark,
        breakoutLookback: strategy.signals.breakoutLookback,
        pullbackMa: strategy.signals.pullbackMa,
        minHistory: strategy.signals.minHistory,
      },
      manage: {
        ...DEFAULT_CONFIG.manage,
        breakevenAtR: strategy.manage.breakevenAtR,
        trailAfterR: strategy.manage.trailAfterR,
        trailSma: strategy.manage.trailSma,
        smaBufferPct: strategy.manage.smaBufferPct,
        maxHoldingDays: strategy.manage.maxHoldingDays,
      },
    };
  }, [strategy]);
  const emDash = t('common.placeholders.emDash');

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

  const liveCaveats = result?.education?.caveats?.length
    ? result.education.caveats
    : [
        t('backtestPage.liveDiff.defaultCaveats.nextBar'),
        t('backtestPage.liveDiff.defaultCaveats.slippage'),
        t('backtestPage.liveDiff.defaultCaveats.liquidity'),
        t('backtestPage.liveDiff.defaultCaveats.dataBias'),
      ];

  const summaryCards = useMemo(() => {
    if (!result) return [];
    const s = result.summary;
    return [
      { label: t('backtestPage.summary.cards.trades'), value: s.trades.toString() },
      { label: t('backtestPage.summary.cards.expectancy'), value: s.expectancyR != null ? formatR(s.expectancyR) : emDash },
      { label: t('backtestPage.summary.cards.winRate'), value: s.winrate != null ? formatPercent(s.winrate * 100) : emDash },
      { label: t('backtestPage.summary.cards.profitFactor'), value: s.profitFactorR != null ? s.profitFactorR.toFixed(2) : emDash },
      { label: t('backtestPage.summary.cards.avgWin'), value: s.avgWinR != null ? formatR(s.avgWinR) : emDash },
      { label: t('backtestPage.summary.cards.avgLoss'), value: s.avgLossR != null ? formatR(s.avgLossR) : emDash },
      {
        label: t('backtestPage.summary.cards.tradesPerYear'),
        value: s.tradeFrequencyPerYear != null ? s.tradeFrequencyPerYear.toFixed(1) : emDash,
      },
      { label: t('backtestPage.summary.cards.maxDrawdown'), value: s.maxDrawdownR != null ? formatR(s.maxDrawdownR) : emDash },
      { label: t('backtestPage.summary.cards.avgR'), value: s.avgR != null ? formatR(s.avgR) : emDash },
    ];
  }, [emDash, result]);

  const budgetCards = useMemo(() => {
    if (!result || !formState.investedBudget) return [];
    const riskPct = strategy?.risk.riskPct ?? config.risk.riskPct;
    if (!riskPct || riskPct <= 0) return [];
    const riskPerR = formState.investedBudget * riskPct;
    const s = result.summary;
    const formatMoney = (val: number | null) =>
      val == null ? emDash : formatCurrency(val * riskPerR);
    return [
      { label: t('backtestPage.summary.budgetCards.expectancy'), value: formatMoney(s.expectancyR) },
      { label: t('backtestPage.summary.budgetCards.avgR'), value: formatMoney(s.avgR) },
      { label: t('backtestPage.summary.budgetCards.maxDrawdown'), value: formatMoney(s.maxDrawdownR != null ? -Math.abs(s.maxDrawdownR) : null) },
      { label: t('backtestPage.summary.budgetCards.bestTrade'), value: formatMoney(s.bestTradeR) },
      { label: t('backtestPage.summary.budgetCards.worstTrade'), value: formatMoney(s.worstTradeR) },
    ];
  }, [emDash, result, formState.investedBudget, strategy, config.risk.riskPct]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('backtestPage.header.title')}</h1>
        <p className="mt-2 text-gray-600">{t('backtestPage.header.subtitle')}</p>
      </div>

      <Card variant="bordered">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{t('backtestPage.parameters.title')}</CardTitle>
            <p className="text-sm text-gray-500">
              {t('backtestPage.parameters.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetToSettings}>
              {t('backtestPage.parameters.resetToSettings')}
            </Button>
            <Button onClick={() => runMutation.mutate(buildRunParams())} disabled={runMutation.isPending || !canRun}>
              {runMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t('backtestPage.parameters.running')}
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {t('backtestPage.parameters.runBacktest')}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.tickers')}</label>
              <input
                type="text"
                value={formState.tickersText}
                onChange={(e) => setFormState((prev) => ({ ...prev, tickersText: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                placeholder={t('backtestPage.parameters.fields.tickersPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.start')}</label>
              <input
                type="date"
                value={formState.start}
                onChange={(e) => setFormState((prev) => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.end')}</label>
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
                {t('backtestPage.parameters.fields.investedBudget')}
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
                placeholder={t('backtestPage.parameters.fields.investedBudgetPlaceholder')}
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('backtestPage.parameters.fields.investedBudgetHint')}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="text-gray-500">{t('backtestPage.parameters.presets')}</span>
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
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.entryType')}</label>
              <select
                value={formState.entryType}
                onChange={(e) => setFormState((prev) => ({ ...prev, entryType: e.target.value as FullEntryType }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              >
                <option value="auto">{t('backtestPage.parameters.fields.entryTypeOptions.auto')}</option>
                <option value="breakout">{t('backtestPage.parameters.fields.entryTypeOptions.breakout')}</option>
                <option value="pullback">{t('backtestPage.parameters.fields.entryTypeOptions.pullback')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.breakoutLookback')}</label>
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
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.pullbackMa')}</label>
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
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.minHistory')}</label>
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
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.atrWindow')}</label>
              <input
                type="number"
                value={formState.atrWindow}
                onChange={(e) => setFormState((prev) => ({ ...prev, atrWindow: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.kAtrStop')}</label>
              <input
                type="number"
                value={formState.kAtr}
                onChange={(e) => setFormState((prev) => ({ ...prev, kAtr: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.commissionPct')}</label>
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
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.breakevenAtR')}</label>
              <input
                type="number"
                value={formState.breakevenAtR}
                onChange={(e) => setFormState((prev) => ({ ...prev, breakevenAtR: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.trailAfterR')}</label>
              <input
                type="number"
                value={formState.trailAfterR}
                onChange={(e) => setFormState((prev) => ({ ...prev, trailAfterR: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.trailSma')}</label>
              <input
                type="number"
                value={formState.trailSma}
                onChange={(e) => setFormState((prev) => ({ ...prev, trailSma: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.smaBufferPct')}</label>
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
              <label className="block text-sm font-medium mb-1">{t('backtestPage.parameters.fields.maxHoldingDays')}</label>
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
          {t('backtestPage.errors.prefix')}: {runMutation.error.message}
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
              <CardTitle>{t('backtestPage.summary.title')}</CardTitle>
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
                <div className="text-sm text-gray-500">{t('backtestPage.summary.empty')}</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>{t('backtestPage.costImpact.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {result?.costs ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">{t('backtestPage.costImpact.cards.commission')}</div>
                    <div className="text-lg font-semibold">{formatPercent(result.costs.commissionPct * 100)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">{t('backtestPage.costImpact.cards.slippageBps')}</div>
                    <div className="text-lg font-semibold">{result.costs.slippageBps.toFixed(1)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">{t('backtestPage.costImpact.cards.fxCost')}</div>
                    <div className="text-lg font-semibold">{formatPercent(result.costs.fxPct * 100)}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">{t('backtestPage.costImpact.cards.avgCostR')}</div>
                    <div className="text-lg font-semibold">
                      {result.costs.avgCostR != null ? formatR(result.costs.avgCostR) : emDash}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">{t('backtestPage.costImpact.cards.totalCostR')}</div>
                    <div className="text-lg font-semibold">
                      {result.costs.totalCostR != null ? formatR(result.costs.totalCostR) : emDash}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">{t('backtestPage.costImpact.cards.grossRTotal')}</div>
                    <div className="text-lg font-semibold">
                      {result.costs.grossRTotal != null ? formatR(result.costs.grossRTotal) : emDash}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">{t('backtestPage.costImpact.cards.netRTotal')}</div>
                    <div className="text-lg font-semibold">
                      {result.costs.netRTotal != null ? formatR(result.costs.netRTotal) : emDash}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600">{t('backtestPage.costImpact.cards.feeImpactPct')}</div>
                    <div className="text-lg font-semibold">
                      {result.costs.feeImpactPct != null ? formatPercent(result.costs.feeImpactPct * 100, 1) : emDash}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">{t('backtestPage.costImpact.empty')}</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>{t('backtestPage.rrDistribution.title')}</CardTitle>
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
                <div className="text-sm text-gray-500">{t('backtestPage.rrDistribution.empty')}</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>{t('backtestPage.education.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {result?.education ? (
                <div className="space-y-3 text-sm">
                  <div className="text-gray-700">{result.education.overview}</div>
                  {result.education.drivers.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500">{t('backtestPage.education.keyDrivers')}</div>
                      <ul className="list-disc ml-5 mt-1 space-y-1">
                        {result.education.drivers.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.education.caveats.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500">{t('backtestPage.education.caveats')}</div>
                      <ul className="list-disc ml-5 mt-1 space-y-1">
                        {result.education.caveats.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">{t('backtestPage.education.empty')}</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>{t('backtestPage.liveDiff.title')}</CardTitle>
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
              <CardTitle>{t('backtestPage.equityCurve.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <EquityCurveChart total={result.curveTotal} byTicker={result.curveByTicker} />
              ) : (
                <div className="text-sm text-gray-500">{t('backtestPage.equityCurve.empty')}</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>{t('backtestPage.summaryByTicker.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <BacktestTickerSummaryTable rows={result.summaryByTicker} />
              ) : (
                <div className="text-sm text-gray-500">{t('backtestPage.summaryByTicker.empty')}</div>
              )}
            </CardContent>
          </Card>

          <Card variant="bordered">
            <CardHeader>
              <CardTitle>{t('backtestPage.trades.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <BacktestTradesTable rows={result.trades} />
              ) : (
                <div className="text-sm text-gray-500">{t('backtestPage.trades.empty')}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>{t('backtestPage.saved.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {simulationsQuery.isLoading && <div className="text-sm text-gray-500">{t('backtestPage.saved.loading')}</div>}
              {simulationsQuery.data && simulationsQuery.data.length === 0 && (
                <div className="text-sm text-gray-500">{t('backtestPage.saved.empty')}</div>
              )}
              <div className="space-y-3">
                {simulationsQuery.data?.map((sim) => (
                  <div key={sim.id} className="border border-border rounded-lg p-3">
                    <div className="text-sm font-semibold">{sim.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDateTime(sim.createdAt)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {t('backtestPage.saved.trades', { count: sim.trades ?? 0 })}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="secondary" onClick={() => handleLoadSimulation(sim.id)}>
                        {t('common.actions.load')}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleDeleteSimulation(sim.id)}>
                        <Trash2 className="w-4 h-4 mr-1" />
                        {t('common.actions.delete')}
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
