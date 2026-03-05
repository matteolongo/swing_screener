import { useCallback, useState } from 'react';
import {
  explainIntelligenceSymbol,
  fetchIntelligenceOpportunities,
  fetchIntelligenceRunStatus,
  runIntelligence,
} from '@/features/intelligence/api';
import type { IntelligenceRunStatus } from '@/features/intelligence/types';
import type { ScreenerCandidate } from '@/features/screener/types';
import { useScreenerStore } from '@/stores/screenerStore';

const POLL_MAX_ATTEMPTS = 120;
const POLL_DELAY_MS = 1000;

type SymbolIntelligenceStage = 'idle' | 'queued' | 'running' | 'completed' | 'error';

export interface SymbolIntelligenceStatus {
  ticker: string;
  stage: SymbolIntelligenceStage;
  jobId?: string;
  asofDate?: string;
  opportunitiesCount?: number;
  llmWarningsCount?: number;
  llmWarningSample?: string;
  explanationSource?: 'llm' | 'deterministic_fallback';
  explanationGeneratedAt?: string;
  warning?: string;
  error?: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildCandidateContext(candidate?: ScreenerCandidate) {
  if (!candidate) {
    return undefined;
  }
  return {
    signal: candidate.signal,
    entry: candidate.entry,
    stop: candidate.stop,
    target: candidate.target,
    rr: candidate.rr,
    confidence: candidate.confidence,
    close: candidate.close,
    atr: candidate.atr,
    sma20: candidate.sma20,
    sma50: candidate.sma50,
    sma200: candidate.sma200,
    momentum6m: candidate.momentum6m,
    momentum12m: candidate.momentum12m,
    relStrength: candidate.relStrength,
  };
}

async function waitForJobCompletion(
  jobId: string,
  onTick: (status: IntelligenceRunStatus) => void
): Promise<IntelligenceRunStatus> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
    const status = await fetchIntelligenceRunStatus(jobId);
    onTick(status);
    if (status.status === 'completed') {
      return status;
    }
    if (status.status === 'error') {
      throw new Error(status.error || 'Intelligence run failed');
    }
    await sleep(POLL_DELAY_MS);
  }
  throw new Error('Intelligence run timed out');
}

export function useSymbolIntelligenceRunner() {
  const lastResult = useScreenerStore((state) => state.lastResult);
  const patchCandidate = useScreenerStore((state) => state.patchCandidate);
  const [statusByTicker, setStatusByTicker] = useState<Record<string, SymbolIntelligenceStatus>>({});

  const runForTicker = useCallback(
    async (ticker: string) => {
      const symbol = normalizeTicker(ticker);
      const currentStatus = statusByTicker[symbol]?.stage;
      if (currentStatus === 'queued' || currentStatus === 'running') {
        return;
      }

      const candidate = lastResult?.candidates.find((item) => normalizeTicker(item.ticker) === symbol);
      setStatusByTicker((prev) => ({
        ...prev,
        [symbol]: {
          ticker: symbol,
          stage: 'queued',
          updatedAt: nowIso(),
        },
      }));

      try {
        const launch = await runIntelligence({ symbols: [symbol] });
        setStatusByTicker((prev) => ({
          ...prev,
          [symbol]: {
            ticker: symbol,
            stage: launch.status === 'queued' ? 'queued' : 'running',
            jobId: launch.jobId,
            updatedAt: nowIso(),
          },
        }));

        const finalStatus = await waitForJobCompletion(launch.jobId, (status) => {
          setStatusByTicker((prev) => ({
            ...prev,
            [symbol]: {
              ticker: symbol,
              stage: status.status === 'queued' ? 'queued' : 'running',
              jobId: status.jobId,
              asofDate: status.asofDate,
              opportunitiesCount: status.opportunitiesCount,
              llmWarningsCount: status.llmWarningsCount,
              llmWarningSample: status.llmWarningSample,
              updatedAt: nowIso(),
            },
          }));
        });

        if (finalStatus.asofDate) {
          await fetchIntelligenceOpportunities(finalStatus.asofDate, [symbol]);
        }

        const explanation = await explainIntelligenceSymbol({
          symbol,
          asofDate: finalStatus.asofDate,
          candidateContext: buildCandidateContext(candidate),
        });

        patchCandidate(symbol, (existing) => {
          if (!existing.recommendation || !existing.recommendation.thesis) {
            return existing;
          }
          return {
            ...existing,
            recommendation: {
              ...existing.recommendation,
              thesis: {
                ...existing.recommendation.thesis,
                beginnerExplanation: {
                  text: explanation.explanation,
                  source: explanation.source,
                  model: explanation.model,
                  generatedAt: explanation.generatedAt,
                },
              },
            },
          };
        });

        setStatusByTicker((prev) => ({
          ...prev,
          [symbol]: {
            ticker: symbol,
            stage: 'completed',
            jobId: finalStatus.jobId,
            asofDate: explanation.asofDate,
            opportunitiesCount: finalStatus.opportunitiesCount,
            llmWarningsCount: finalStatus.llmWarningsCount,
            llmWarningSample: finalStatus.llmWarningSample,
            explanationSource: explanation.source,
            explanationGeneratedAt: explanation.generatedAt,
            warning: explanation.warning || finalStatus.llmWarningSample,
            updatedAt: nowIso(),
          },
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to run intelligence';
        setStatusByTicker((prev) => ({
          ...prev,
          [symbol]: {
            ticker: symbol,
            stage: 'error',
            error: message,
            updatedAt: nowIso(),
          },
        }));
      }
    },
    [lastResult, patchCandidate, statusByTicker]
  );

  const getStatusForTicker = useCallback(
    (ticker: string): SymbolIntelligenceStatus | undefined => {
      const symbol = normalizeTicker(ticker);
      return statusByTicker[symbol];
    },
    [statusByTicker]
  );

  return {
    runForTicker,
    getStatusForTicker,
    statusByTicker,
  };
}
