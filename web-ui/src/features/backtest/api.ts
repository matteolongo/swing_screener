import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import {
  BacktestResult,
  EventStudyLaunchResponseAPI,
  EventStudyRequest,
  EventStudyResponseAPI,
  EventStudyStatusResponseAPI,
  transformEventStudyResponse,
} from './types';

function serializeConfig(config: EventStudyRequest['config']): Record<string, unknown> | undefined {
  if (!config) return undefined;
  const out: Record<string, unknown> = {};
  const map: Record<string, unknown> = {
    pattern_stop_enabled: config.patternStopEnabled,
    pattern_stop_atr_buffer: config.patternStopAtrBuffer,
    breakeven_at_r: config.breakevenAtR,
    trail_after_r: config.trailAfterR,
    trail_sma: config.trailSma,
    max_holding_days: config.maxHoldingDays,
    exit_signal_days: config.exitSignalDays,
    k_atr: config.kAtr,
    rr_target: config.rrTarget,
    breakout_lookback: config.breakoutLookback,
    pullback_ma: config.pullbackMa,
    min_history: config.minHistory,
  };
  for (const [key, value] of Object.entries(map)) {
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function runEventStudy(request: EventStudyRequest): Promise<BacktestResult> {
  const apiRequest = {
    tickers: request.tickers,
    start: request.start,
    end: request.end,
    config: serializeConfig(request.config),
  };

  const res = await fetch(apiUrl(API_ENDPOINTS.backtestEventStudy), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiRequest),
  });

  if (res.status === 202) {
    const launchPayload: EventStudyLaunchResponseAPI = await res.json();
    return pollEventStudyResult(launchPayload.job_id);
  }

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to run backtest');
  }
  const apiResponse: EventStudyResponseAPI = await res.json();
  return transformEventStudyResponse(apiResponse);
}

// A multi-symbol replay can run well past a request budget, so the polling
// window is generous and the delay backs off to keep request volume low.
const POLL_BUDGET_MS = 30 * 60 * 1000;
const POLL_INITIAL_DELAY_MS = 1000;
const POLL_MAX_DELAY_MS = 5000;

async function pollEventStudyResult(jobId: string): Promise<BacktestResult> {
  const startedAt = Date.now();
  let delayMs = POLL_INITIAL_DELAY_MS;

  while (Date.now() - startedAt < POLL_BUDGET_MS) {
    const statusPayload = await fetchJson<EventStudyStatusResponseAPI>(
      API_ENDPOINTS.backtestEventStudyStatus(jobId),
      { errorMessage: 'Failed to fetch backtest status' }
    );
    if (statusPayload.status === 'completed' && statusPayload.result) {
      return transformEventStudyResponse(statusPayload.result);
    }
    if (statusPayload.status === 'error') {
      throw new Error(statusPayload.error || 'Backtest run failed');
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 1.5, POLL_MAX_DELAY_MS);
  }

  throw new Error('Backtest run timed out. Please try again.');
}
