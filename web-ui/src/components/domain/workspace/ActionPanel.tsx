import OrderActionPanel from '@/components/domain/orders/OrderActionPanel';
import type { OrderReviewContext } from '@/components/domain/orders/OrderReviewExperience';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { useConfigDefaultsQuery } from '@/features/config/hooks';
import { useCreateOrderMutation, useOpenPositions } from '@/features/portfolio/hooks';
import type { SameSymbolCandidateContext } from '@/features/screener/types';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';
import { formatConfidencePercent, formatCurrency, formatScreenerScore } from '@/utils/formatters';

interface ActionPanelProps {
  ticker: string;
}

function resolveSameSymbolContext(
  candidate: SymbolAnalysisCandidate | null,
  openPosition:
    | {
        positionId?: string;
        entryPrice: number;
        stopPrice: number;
      }
    | undefined,
): SameSymbolCandidateContext | undefined {
  if (candidate?.sameSymbol?.mode === 'ADD_ON') {
    return candidate.sameSymbol;
  }

  if (openPosition?.positionId) {
    return {
      mode: 'ADD_ON',
      positionId: openPosition.positionId,
      currentPositionEntry: openPosition.entryPrice,
      currentPositionStop: openPosition.stopPrice,
      freshSetupStop: candidate?.sameSymbol?.freshSetupStop ?? candidate?.stop,
      executionStop: openPosition.stopPrice,
      pendingEntryExists: candidate?.sameSymbol?.pendingEntryExists ?? false,
      addOnCount: candidate?.sameSymbol?.addOnCount ?? 0,
      maxAddOns: candidate?.sameSymbol?.maxAddOns,
      reason: 'Workspace inferred add-on mode from the current open position.',
    };
  }

  return candidate?.sameSymbol;
}

function signalFromAction(action?: string | null): string | null {
  const normalized = String(action ?? '').toLowerCase();
  if (normalized === 'buy_on_pullback') return 'pullback';
  if (normalized === 'buy_now' || normalized === 'wait_for_breakout') return 'breakout';
  return null;
}

function buildDefaultNotes(
  candidate: SymbolAnalysisCandidate | null,
  sameSymbol: SameSymbolCandidateContext | undefined,
  normalizedTicker: string,
): string {
  if (!candidate) {
    return t('workspacePage.panels.analysis.manualOrderNotes', { ticker: normalizedTicker });
  }

  if (sameSymbol?.mode === 'ADD_ON') {
    return t('screener.addOnNotes', {
      score: formatScreenerScore(candidate.score ?? 0),
      confidence: formatConfidencePercent(candidate.confidence ?? 0),
      rank: candidate.rank ?? '—',
      liveStop: sameSymbol.currentPositionStop != null
        ? formatCurrency(sameSymbol.currentPositionStop, candidate.currency)
        : '—',
      freshStop: sameSymbol.freshSetupStop != null
        ? formatCurrency(sameSymbol.freshSetupStop, candidate.currency)
        : '—',
    });
  }

  return t('screener.defaultNotes', {
    score: formatScreenerScore(candidate.score ?? 0),
    confidence: formatConfidencePercent(candidate.confidence ?? 0),
    rank: candidate.rank ?? '—',
  });
}

export default function ActionPanel({ ticker }: ActionPanelProps) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const activeStrategyQuery = useActiveStrategyQuery();
  const configDefaultsQuery = useConfigDefaultsQuery();
  const risk = activeStrategyQuery.data?.risk ?? configDefaultsQuery.data?.risk;
  const openPositionsQuery = useOpenPositions();
  const openPosition = openPositionsQuery.data?.find((position) => position.ticker.toUpperCase() === normalizedTicker);
  const candidate = useScreenerStore((state) =>
    state.lastResult?.candidates.find((item) => item.ticker.toUpperCase() === normalizedTicker)
  );
  const createOrderMutation = useCreateOrderMutation();

  const sameSymbol = resolveSameSymbolContext(candidate ?? null, openPosition);
  const defaultNotes = buildDefaultNotes(candidate ?? null, sameSymbol, normalizedTicker);

  if (!risk) {
    const configFailed = configDefaultsQuery.isError && !activeStrategyQuery.data?.risk;
    return (
      <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
        <p className={configFailed ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
          {configFailed ? t('common.errors.generic') : t('common.table.loading')}
        </p>
      </div>
    );
  }

  const context: OrderReviewContext = {
    ticker: normalizedTicker,
    signal: candidate?.signal ?? signalFromAction(candidate?.decisionSummary?.action),
    close: candidate?.close,
    entry: candidate?.entry,
    stop: sameSymbol?.mode === 'ADD_ON' && sameSymbol.executionStop != null ? sameSymbol.executionStop : candidate?.stop,
    shares: candidate?.shares,
    recommendation: candidate?.recommendation,
    sector: candidate?.sector ?? undefined,
    rReward: candidate?.rr,
    score: candidate?.score,
    rank: candidate?.rank,
    atr: candidate?.atr,
    currency: candidate?.currency,
    suggestedOrderType: candidate?.suggestedOrderType,
    suggestedOrderPrice: candidate?.suggestedOrderPrice,
    executionNote: candidate?.executionNote,
    positionId: sameSymbol?.positionId,
    sameSymbol,
  };

  return (
    <OrderActionPanel
      context={context}
      risk={risk}
      defaultNotes={defaultNotes}
      showManualOrderHint={!candidate}
      onSubmitOrder={(request) => createOrderMutation.mutateAsync(request)}
    />
  );
}
