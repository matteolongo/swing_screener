import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { t } from '@/i18n/t';
import {
  FullBacktestParams,
  FullBacktestResponse,
  FullBacktestResponseAPI,
  BacktestSimulationMeta,
  BacktestSimulationMetaAPI,
  BacktestSimulation,
  BacktestSimulationAPI,
  transformFullBacktestResponse,
  transformBacktestSimulationMeta,
  transformBacktestSimulation,
} from './types';

export async function fetchSimulations(): Promise<BacktestSimulationMeta[]> {
  const res = await fetch(apiUrl(API_ENDPOINTS.backtestSimulations));
  if (!res.ok) throw new Error(t('backtestPage.apiErrors.fetchSimulations'));
  const data: BacktestSimulationMetaAPI[] = await res.json();
  return data.map(transformBacktestSimulationMeta);
}

export async function runBacktest(params: FullBacktestParams): Promise<FullBacktestResponse> {
  const payload = {
    tickers: params.tickers,
    start: params.start,
    end: params.end,
    invested_budget: params.investedBudget && params.investedBudget > 0 ? params.investedBudget : undefined,
    entry_type: params.entryType,
    breakout_lookback: params.breakoutLookback,
    pullback_ma: params.pullbackMa,
    min_history: params.minHistory,
    atr_window: params.atrWindow,
    k_atr: params.kAtr,
    breakeven_at_r: params.breakevenAtR,
    trail_after_r: params.trailAfterR,
    trail_sma: params.trailSma,
    sma_buffer_pct: params.smaBufferPct,
    max_holding_days: params.maxHoldingDays,
    commission_pct: params.commissionPct,
  };

  const res = await fetch(apiUrl(API_ENDPOINTS.backtestRun), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || t('backtestPage.apiErrors.runBacktest'));
  }
  const data: FullBacktestResponseAPI = await res.json();
  return transformFullBacktestResponse(data);
}

export async function fetchSimulation(id: string): Promise<BacktestSimulation> {
  const res = await fetch(apiUrl(API_ENDPOINTS.backtestSimulation(id)));
  if (!res.ok) throw new Error(t('backtestPage.apiErrors.fetchSimulation'));
  const data: BacktestSimulationAPI = await res.json();
  return transformBacktestSimulation(data);
}

export async function deleteSimulation(id: string): Promise<void> {
  const res = await fetch(apiUrl(API_ENDPOINTS.backtestSimulation(id)), {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(t('backtestPage.apiErrors.deleteSimulation'));
}
