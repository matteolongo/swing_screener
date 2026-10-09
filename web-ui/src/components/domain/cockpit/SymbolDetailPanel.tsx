import { useEffect, useRef, useState } from 'react';
import Badge from '@/components/common/Badge';
import ModalShell from '@/components/common/ModalShell';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import CachedSymbolCandleChart from '@/components/domain/market/CachedSymbolCandleChart';
import { getWorkflowPresentation } from '@/components/domain/recommendation/workflowPresentation';
import type { WorkflowTone } from '@/components/domain/recommendation/workflowPresentation';
import AnalysisDecisionStrip from '@/components/domain/workspace/AnalysisDecisionStrip';
import DecisionWhyPanel from '@/components/domain/workspace/DecisionWhyPanel';
import FundamentalsStrip from '@/components/domain/workspace/FundamentalsStrip';
import ManagePositionPanel from '@/components/domain/workspace/ManagePositionPanel';
import NarrativeAnalysisCard from '@/components/domain/workspace/NarrativeAnalysisCard';
import SymbolBacktestTab from '@/components/domain/workspace/SymbolBacktestTab';
import SymbolIntelligenceTab from '@/components/domain/workspace/SymbolIntelligenceTab';
import VolumeZonesTab from '@/components/domain/workspace/VolumeZonesTab';
import { useFundamentalSnapshotQuery } from '@/features/fundamentals/hooks';
import {
  findRunByAttemptId,
  resolveRunId,
  useEvidenceRefreshMutation,
  useIntelligenceAnalysisMutation,
  useIntelligenceLatestQuery,
  useRunTrace,
  useTickerRuns,
} from '@/features/intelligence/hooks';
import type {
  EvidenceRefreshResponse,
  SymbolIntelligence,
} from '@/features/intelligence/types';
import { useOpenPositions } from '@/features/portfolio/hooks';
import { getCanonicalOrderDraft } from '@/features/screener/types';
import {
  useUnwatchSymbolMutation,
  useWatchlist,
  useWatchSymbolMutation,
} from '@/features/watchlist/hooks';
import { useSymbolWorkspaceData } from '@/features/workspaceData/useSymbolWorkspaceData';
import { isIntelligenceOutdated } from '@/features/workspaceData/health';
import { t } from '@/i18n/t';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useScreenerStore } from '@/stores/screenerStore';
import { useCandidateAnalysis } from '@/features/workspaceData/useCandidateAnalysis';
import ManualOrderDraftForm from '@/components/domain/orders/ManualOrderDraftForm';

interface SymbolDetailPanelProps {
  ticker: string;
  onClose: () => void;
  isRefreshingToday?: boolean;
  onRefreshToday?: () => void;
  todayRefreshError?: Error | null;
}

type SecondaryTab = 'intelligence' | 'backtest' | 'volumeZones';

function workflowBadgeVariant(tone: WorkflowTone): 'success' | 'warning' | 'error' | 'default' {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'error';
    case 'neutral':
      return 'default';
  }
}

export default function SymbolDetailPanel({ ticker, onClose, isRefreshingToday = false, onRefreshToday, todayRefreshError }: SymbolDetailPanelProps) {
  const normalized = ticker.trim().toUpperCase();
  const selection = useWorkspaceStore((s) => s.selection);
  const selectionVersion = useWorkspaceStore((s) => s.selectionVersion);
  const setAnalysisTab = useWorkspaceStore((s) => s.setAnalysisTab);
  const analysisTab = useWorkspaceStore((s) => s.analysisTab);
  const [secondaryTab, setSecondaryTab] = useState<SecondaryTab | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  useEffect(() => { setShowDraft(false); }, [normalized, selectionVersion]);

  // WorkspaceSelection envelope: the already-selected candidate snapshot travels
  // with the selection (CandidateQueue writes it). Never look the ticker back up
  // in the screener Last Run store here.
  const selectedCandidate =
    selection?.ticker === normalized ? (selection.candidate ?? null) : null;
  const benchmarkTicker = useScreenerStore((state) => {
    if (state.todayRun && selection?.source === 'today_run' && selection.runId === state.todayRun.completedAt) return state.todayRun.result.benchmarkTicker ?? null;
    if (selection?.source === 'last_run' && selection.runId === state.lastRunContext?.completedAt) return state.lastResult?.benchmarkTicker ?? null;
    return null;
  });
  const runRequest = useScreenerStore((state) => {
    if (state.todayRun && selection?.source === 'today_run' && selection.runId === state.todayRun.completedAt) return state.todayRun.request;
    if (selection?.source === 'last_run' && selection.runId === state.lastRunContext?.completedAt) return state.lastRunContext?.request;
    return undefined;
  });
  const candidateAnalysis = useCandidateAnalysis(normalized, selectedCandidate, selectionVersion, benchmarkTicker, runRequest);
  const candidate = candidateAnalysis.candidate;

  const openPositionsQuery = useOpenPositions();
  const position =
    openPositionsQuery.data?.find((p) => p.ticker.toUpperCase() === normalized) ?? null;

  const fundamentalsQuery = useFundamentalSnapshotQuery(normalized);
  const fundamentals = fundamentalsQuery.data ?? null;
  const intelligenceQuery = useIntelligenceLatestQuery(normalized, Boolean(normalized));
  const intelligence = intelligenceQuery.data ?? null;

  // Live intelligence workflow: the same mutation/query/trace wiring
  // SymbolAnalysisContent owns for its intelligence tab (no stubbed props).
  // Evidence sources come from the same useSymbolWorkspaceData hook the
  // full symbol views feed into SymbolAnalysisContent.
  const [evidenceRefresh, setEvidenceRefresh] = useState<EvidenceRefreshResponse | null>(null);
  const evidenceRefreshActionRef = useRef<(() => void) | null>(null);
  const workspaceData = useSymbolWorkspaceData({
    ticker: normalized,
    selectionVersion,
    candidate,
    position,
    screenerRun: candidate?.lastBar
      ? { asOf: candidate.lastBar, freshness: candidate.dataStatus === 'intraday' ? 'intraday' : 'final_close' }
      : null,
    evidenceRefresh,
    refreshEvidence: () => evidenceRefreshActionRef.current?.(),
  });

  const intelligenceMutation = useIntelligenceAnalysisMutation();
  const evidenceRefreshMutation = useEvidenceRefreshMutation();
  const [intelligenceResult, setIntelligenceResult] = useState<SymbolIntelligence | null>(null);
  const [attemptedRunId, setAttemptedRunId] = useState<string | null>(null);
  const [lastAttemptForce, setLastAttemptForce] = useState(false);
  const [refreshedEvidence, setRefreshedEvidence] =
    useState<EvidenceRefreshResponse | null>(null);
  const currentSession = `${normalized}:${selectionVersion}`;
  const currentSessionRef = useRef(currentSession);
  const mountedRef = useRef(true);
  const displayedIntelligence = intelligenceResult ?? intelligence ?? null;
  const tickerRuns = useTickerRuns(normalized, secondaryTab === 'intelligence');
  const traceRunId = resolveRunId(
    tickerRuns.data,
    attemptedRunId,
    displayedIntelligence?.runId,
    intelligenceMutation.isError,
  );
  const persistedAttemptForce = tickerRuns.data?.find(
    (run) => run.runId === traceRunId,
  )?.attemptForce;
  const runTrace = useRunTrace(
    traceRunId,
    secondaryTab === 'intelligence' && Boolean(traceRunId),
  );
  const isIntelligenceLoading = !intelligenceResult && intelligenceQuery.isLoading;

  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestMatchesLiveSession = (
    requestedSession: string,
    responseTicker?: string | null,
  ) => {
    const workspace = useWorkspaceStore.getState();
    const workspaceMatches = selectionVersion === 0
      || (
        workspace.selectedTicker === normalized
        && workspace.selectionVersion === selectionVersion
      );
    return mountedRef.current
      && requestedSession === currentSessionRef.current
      && workspaceMatches
      && (responseTicker == null || responseTicker.trim().toUpperCase() === normalized);
  };

  const handleAnalyzeWithAi = (force = false) => {
    const requestedSession = `${normalized}:${selectionVersion}`;
    const attemptId = globalThis.crypto.randomUUID();
    const requestId = globalThis.crypto.randomUUID();
    useWorkspaceStore.getState().beginActivity({
      requestId,
      ticker: normalized,
      selectionVersion,
      sourceId: 'intelligence',
      phase: 'active',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      provider: null,
      message: null,
      retryable: false,
      pipelineStep: force ? 'regenerate-analysis' : 'generate-analysis',
      announced: false,
    });
    setAttemptedRunId(null);
    setLastAttemptForce(force);
    intelligenceMutation.mutate(
      { ticker: normalized, candidate, position, force, attemptId },
      {
        onSuccess: (result) => {
          if (requestMatchesLiveSession(requestedSession, result.symbol)) {
            setIntelligenceResult(result);
          }
        },
        onSettled: async (result, error) => {
          const refreshedRuns = await tickerRuns.refetch();
          const sessionChanged = !requestMatchesLiveSession(
            requestedSession,
            result?.symbol,
          );
          useWorkspaceStore.getState().settleActivity(requestId, {
            phase: sessionChanged ? 'discarded' : error ? 'failed' : 'completed',
            finishedAt: new Date().toISOString(),
            message: sessionChanged
              ? t('workspacePage.data.activitySelectionChanged')
              : error?.message ?? null,
            retryable: !sessionChanged && Boolean(error),
          });
          if (sessionChanged || !mountedRef.current) return;
          const attemptedRun = findRunByAttemptId(
            refreshedRuns.data ?? [],
            normalized,
            attemptId,
          );
          setAttemptedRunId(attemptedRun?.runId ?? null);
        },
      }
    );
  };

  const handleRefreshEvidence = () => {
    const requestedSession = `${normalized}:${selectionVersion}`;
    const requestId = globalThis.crypto.randomUUID();
    useWorkspaceStore.getState().beginActivity({
      requestId,
      ticker: normalized,
      selectionVersion,
      sourceId: 'evidence',
      phase: 'active',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      provider: null,
      message: null,
      retryable: false,
      pipelineStep: 'refresh-evidence',
      announced: false,
    });
    setRefreshedEvidence(null);
    evidenceRefreshMutation.mutate(normalized, {
      onSuccess: (result) => {
        if (requestMatchesLiveSession(requestedSession, result.ticker)) {
          setRefreshedEvidence(result);
          setEvidenceRefresh(result);
        }
      },
      onSettled: (result, error) => {
        const sessionChanged = !requestMatchesLiveSession(
          requestedSession,
          result?.ticker,
        );
        const responseFailed = result?.status === 'failed';
        const responsePartial = result?.status === 'partial';
        useWorkspaceStore.getState().settleActivity(requestId, {
          phase: sessionChanged
            ? 'discarded'
            : error || responseFailed ? 'failed'
              : result?.status === 'partial' ? 'partial' : 'completed',
          finishedAt: new Date().toISOString(),
          provider: result?.sources.map(({ provider }) => provider).join(', ') || null,
          message: sessionChanged
            ? t('workspacePage.data.activitySelectionChanged')
            : error?.message
              ?? result?.sources.find(({ status }) => status === 'failed')?.message
              ?? null,
          retryable: !sessionChanged && Boolean(error || responseFailed || responsePartial),
        });
      },
    });
  };
  evidenceRefreshActionRef.current = handleRefreshEvidence;

  useEffect(() => {
    setEvidenceRefresh(null);
  }, [normalized, selectionVersion]);

  useEffect(() => {
    setIntelligenceResult(null);
    setAttemptedRunId(null);
    setLastAttemptForce(false);
    setRefreshedEvidence(null);
    intelligenceMutation.reset();
    evidenceRefreshMutation.reset();
  }, [normalized, selectionVersion]);

  const watchlistQuery = useWatchlist();
  const watchSymbolMutation = useWatchSymbolMutation();
  const unwatchSymbolMutation = useUnwatchSymbolMutation();
  const watchedTickers = new Set(
    (watchlistQuery.data ?? []).map((item) => item.ticker.toUpperCase()),
  );
  const isWatched = watchedTickers.has(normalized);
  const isWatchPending =
    (watchSymbolMutation.isPending &&
      watchSymbolMutation.variables?.ticker?.toUpperCase() === normalized) ||
    (unwatchSymbolMutation.isPending &&
      unwatchSymbolMutation.variables?.toUpperCase() === normalized);
  const watchMutationError = watchSymbolMutation.error ?? unwatchSymbolMutation.error;
  const watchError = watchSymbolMutation.isError || unwatchSymbolMutation.isError
    ? (watchMutationError instanceof Error ? watchMutationError.message : t('workspacePage.overview.watchError'))
    : null;

  const orderDraft = getCanonicalOrderDraft(candidate);
  const canReviewOrder = Boolean(orderDraft) && !isRefreshingToday;

  const workflowPresentation = getWorkflowPresentation(candidate?.recommendation);
  const company = candidate?.name ?? fundamentals?.companyName ?? null;

  const aiStale = Boolean(displayedIntelligence) && isIntelligenceOutdated(displayedIntelligence?.generatedAt ?? null, [
    candidate?.lastBar ?? null,
    fundamentals?.updatedAt ?? null,
    workspaceData.prices.data?.dataAsOf ?? candidate?.priceHistory?.slice(-1)[0]?.date ?? null,
  ]);

  return (
    <div
      data-testid="symbol-detail-panel"
      className="fixed inset-0 z-40 flex flex-col gap-3 overflow-y-auto border border-border bg-surface p-3 md:sticky md:top-0 md:h-full md:w-[420px] md:shrink-0"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border border-border bg-surface p-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-foreground">{normalized}</div>
          {company ? <div className="truncate text-xs text-muted">{company}</div> : null}
          {candidate?.recommendation ? (
            <div className="mt-1">
              <Badge variant={workflowBadgeVariant(workflowPresentation.tone)}>
                {t(workflowPresentation.labelKey)}
              </Badge>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('cockpit.detail.close')}
          className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          {t('cockpit.detail.close')}
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t('cockpit.detail.action')}</h2>
        <AnalysisDecisionStrip
          ticker={normalized}
          candidate={candidate}
          position={position}
          onPrepareOrder={canReviewOrder ? () => setAnalysisTab('order') : undefined}
          onSaveDraft={!isRefreshingToday ? () => setShowDraft(true) : undefined}
          isWatched={isWatched}
          isPendingWatch={isWatchPending}
          onWatch={() =>
            watchSymbolMutation.mutate({
              ticker: normalized,
              watchPrice: candidate?.close ?? null,
              currency: candidate?.currency ?? null,
              source: 'analysis',
            })
          }
          onUnwatch={() => unwatchSymbolMutation.mutate(normalized)}
          candidateRefresh={{
            onRefresh: ['today_run', 'last_run'].includes(selection?.source ?? '')
              ? onRefreshToday ?? candidateAnalysis.refresh
              : candidateAnalysis.refresh,
            isPending: isRefreshingToday || candidateAnalysis.isPending,
            error: todayRefreshError ?? candidateAnalysis.error,
            asOf: candidateAnalysis.refreshedResult ? candidate?.lastBar ?? candidateAnalysis.refreshedResult.asofDate : null,
            freshness: candidateAnalysis.refreshedResult?.dataFreshness,
          }}
        />
        {watchError ? (
          <p role="alert" className="text-xs text-danger">{watchError}</p>
        ) : null}
        <DecisionWhyPanel
          summary={candidate?.decisionSummary ?? null}
          recommendation={candidate?.recommendation ?? null}
          aiSummaryLine={intelligence?.summaryLine ?? null}
        />
        <FundamentalsStrip
          trailingPe={fundamentals?.trailingPe}
          revenueGrowthYoy={fundamentals?.revenueGrowthYoy}
          grossMargin={fundamentals?.grossMargin}
          valuationLabel={candidate?.decisionSummary?.valuationLabel ?? null}
        />
        {position ? <ManagePositionPanel position={position} candidate={candidate} /> : null}
        <p className="text-xs text-muted">{t('cockpit.detail.manualNote')}</p>
      </section>

      {analysisTab === 'order' && canReviewOrder ? (
        <ModalShell
          key={`${normalized}:${selectionVersion}`}
          title={t('analysis.prepareOrder')}
          onClose={() => setAnalysisTab('overview')}
          className="max-w-3xl"
          closeOnBackdrop={false}
        >
          <ActionPanel
            ticker={normalized}
            candidate={candidate}
            source={workspaceData.sourceStates.find(({ id }) => id === 'positionOrders')}
          />
        </ModalShell>
      ) : null}
      {showDraft ? <ModalShell title={t('manualOrderDraft.title', { ticker: normalized })} onClose={() => setShowDraft(false)} className="max-w-xl" closeOnBackdrop={false}><ManualOrderDraftForm ticker={normalized} candidate={candidate} /></ModalShell> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t('cockpit.detail.chart')}</h2>
        <div className="rounded-lg border border-border bg-surface p-3">
          <CachedSymbolCandleChart ticker={normalized} candidate={candidate} benchmarkTicker={candidateAnalysis.benchmarkTicker} width={820} height={220} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t('cockpit.detail.ai')}</h2>
        {aiStale ? (
          <div>
            <Badge variant="warning">{t('cockpit.detail.aiStale')}</Badge>
          </div>
        ) : null}
        {displayedIntelligence ? (
          <NarrativeAnalysisCard
            intelligence={displayedIntelligence}
            candidate={candidate}
            isPosition={Boolean(position)}
          />
        ) : (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
            {t('workspacePage.intelligence.empty')}
          </p>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('cockpit.detail.approve')}
        </h3>
        <div
          role="tablist"
          aria-label={t('cockpit.detail.approve')}
          className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
        >
          {(
            [
              { id: 'intelligence', label: t('workspacePage.panels.analysis.tabs.intelligence') },
              { id: 'backtest', label: t('workspacePage.panels.analysis.tabs.backtest') },
              { id: 'volumeZones', label: t('workspacePage.panels.analysis.tabs.volumeZones') },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={secondaryTab === tab.id}
              onClick={() => setSecondaryTab((current) => (current === tab.id ? null : tab.id))}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
            >
              {tab.label}
            </button>
          ))}
        </div>
        {secondaryTab === 'intelligence' ? (
          <SymbolIntelligenceTab
            model={{
              ticker: normalized,
              selectionVersion,
              candidate,
              position,
              analysis: displayedIntelligence,
              intelligenceOutdated: aiStale,
              sources: workspaceData.sourceStates,
              trace:
                runTrace.data?.ticker.trim().toUpperCase() === normalized
                  ? runTrace.data
                  : null,
              isLoadingAnalysis: isIntelligenceLoading,
              isCachedAnalysis:
                !intelligenceResult && intelligenceQuery.isFetchedAfterMount === false,
              isGenerating: intelligenceMutation.isPending,
              isRefreshingEvidence: evidenceRefreshMutation.isPending,
              generationError: intelligenceMutation.error,
              failedGenerationForce: persistedAttemptForce ?? lastAttemptForce,
              refreshError: evidenceRefreshMutation.error,
              refreshedEvidence,
              onRefreshEvidence: handleRefreshEvidence,
              onGenerate: handleAnalyzeWithAi,
            }}
          />
        ) : null}
        {secondaryTab === 'backtest' ? <SymbolBacktestTab ticker={normalized} /> : null}
        {secondaryTab === 'volumeZones' ? (
          <VolumeZonesTab
            ticker={normalized}
            sources={workspaceData.sourceStates.filter(
              ({ id }) => id === 'prices' || id === 'screener',
            )}
          />
        ) : null}
      </div>
    </div>
  );
}
