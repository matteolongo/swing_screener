import OrderActionPanel from '@/components/domain/orders/OrderActionPanel';
import type { OrderReviewContext } from '@/components/domain/orders/OrderReviewExperience';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { useConfigDefaultsQuery } from '@/features/config/hooks';
import { useCreateOrderMutation, useOpenPositions } from '@/features/portfolio/hooks';
import type { SameSymbolCandidateContext, ScreenerCandidate } from '@/features/screener/types';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';
import { formatConfidencePercent, formatCurrency, formatScreenerScore } from '@/utils/formatters';
import { formatWorkflowNextStep } from '@/components/domain/recommendation/workflowPresentation';
import type { WorkspaceSourceState } from '@/features/workspaceData/types';
import SourceHealthSummary from './SourceHealthSummary';

interface ActionPanelProps {
  ticker: string;
  candidate?: ScreenerCandidate | null;
  source?: WorkspaceSourceState;
}

type PositionEntryContext = SameSymbolCandidateContext & { mode: 'ADD_ON' | 'SCALE_BACK' };

function isPositionEntryContext(
  context?: SameSymbolCandidateContext,
): context is PositionEntryContext {
  return context?.mode === 'ADD_ON' || context?.mode === 'SCALE_BACK';
}

function resolveSameSymbolContext(candidate: SymbolAnalysisCandidate | null): SameSymbolCandidateContext | undefined {
  return candidate?.sameSymbol;
}

function buildDefaultNotes(
  candidate: SymbolAnalysisCandidate | null,
  sameSymbol: SameSymbolCandidateContext | undefined,
  normalizedTicker: string,
): string {
  if (!candidate) {
    return t('workspacePage.panels.analysis.manualOrderNotes', { ticker: normalizedTicker });
  }

  if (isPositionEntryContext(sameSymbol)) {
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

export default function ActionPanel({ ticker, candidate: candidateOverride, source }: ActionPanelProps) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const activeStrategyQuery = useActiveStrategyQuery();
  const configDefaultsQuery = useConfigDefaultsQuery();
  const risk = activeStrategyQuery.data?.risk ?? configDefaultsQuery.data?.risk;
  const openPositionsQuery = useOpenPositions();
  const openPosition = openPositionsQuery.data?.find((position) => position.ticker.toUpperCase() === normalizedTicker);
  const storeCandidate = useScreenerStore((state) =>
    state.lastResult?.candidates.find((item) => item.ticker.toUpperCase() === normalizedTicker)
  );
  const candidate = candidateOverride === undefined ? storeCandidate : candidateOverride;
  const createOrderMutation = useCreateOrderMutation();

  const sameSymbol = resolveSameSymbolContext(candidate ?? null);
  const defaultNotes = buildDefaultNotes(candidate ?? null, sameSymbol, normalizedTicker);
  const isReadyCandidate = candidate?.recommendation?.workflowStatus === 'ready';
  const canReviewOrder = Boolean(
    isReadyCandidate &&
      (!openPosition || isPositionEntryContext(candidate?.sameSymbol)),
  );

  if (!risk) {
    const configFailed = configDefaultsQuery.isError && !activeStrategyQuery.data?.risk;
    return (
      <div className="rounded-lg border border-border p-3 text-sm">
        <p className={configFailed ? 'text-danger' : 'text-muted'}>
          {configFailed ? t('common.errors.generic') : t('common.table.loading')}
        </p>
      </div>
    );
  }

  const context: OrderReviewContext = {
    ticker: normalizedTicker,
    signal: candidate?.signal,
    close: candidate?.close,
    entry: candidate?.entry,
    stop: isPositionEntryContext(sameSymbol) && sameSymbol.executionStop != null ? sameSymbol.executionStop : candidate?.stop,
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
    avgDailyVolumeEur: candidate?.avgDailyVolumeEur ?? null,
    dataStatus: candidate?.dataStatus ?? 'unknown',
    dataAsOf: candidate?.dataAsOf ?? candidate?.lastBar,
    daysToEarnings: candidate?.daysToEarnings ?? null,
    strategyId: activeStrategyQuery.data?.id,
    approvalToken: candidate?.approvalToken,
  };

  const content = canReviewOrder ? (
    <OrderActionPanel
      context={context}
      risk={risk}
      defaultNotes={defaultNotes}
      showManualOrderHint={!candidate}
      onSubmitOrder={(request) => createOrderMutation.mutateAsync(request)}
    />
  ) : (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        {t('workspacePage.panels.analysis.orderUnavailable.title')}
      </h3>
      <p className="text-sm text-muted">
        {candidate?.recommendation
          ? formatWorkflowNextStep(candidate.recommendation.nextStep)
          : t('workspacePage.panels.analysis.orderUnavailable.noCandidate')}
      </p>
    </div>
  );

  return (
    <div className="space-y-2">
      <SourceHealthSummary sources={source ? [source] : []} />
      {content}
    </div>
  );
}
