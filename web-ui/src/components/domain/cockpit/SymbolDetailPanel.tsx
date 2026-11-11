import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, X } from 'lucide-react';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import ModalShell from '@/components/common/ModalShell';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import CachedSymbolCandleChart from '@/components/domain/market/CachedSymbolCandleChart';
import { getWorkflowPresentation } from '@/components/domain/recommendation/workflowPresentation';
import type { WorkflowTone } from '@/components/domain/recommendation/workflowPresentation';
import AnalysisDecisionStrip from '@/components/domain/workspace/AnalysisDecisionStrip';
import DecisionWhyPanel from '@/components/domain/workspace/DecisionWhyPanel';
import FundamentalsStrip from '@/components/domain/workspace/FundamentalsStrip';
import ManagePositionPanel from '@/components/domain/workspace/ManagePositionPanel';
import SymbolBacktestTab from '@/components/domain/workspace/SymbolBacktestTab';
import SymbolIntelligenceTab from '@/components/domain/workspace/SymbolIntelligenceTab';
import TechnicalMetricsGrid from '@/components/domain/workspace/TechnicalMetricsGrid';
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
import { formatDateTime } from '@/utils/formatters';

interface SymbolDetailPanelProps {
  ticker: string;
  onClose: () => void;
  focusRequest?: number | null;
  isRefreshingToday?: boolean;
  onRefreshToday?: () => void;
  todayRefreshError?: Error | null;
}

type SecondaryTab = 'intelligence' | 'backtest' | 'volumeZones';

function ReviewDepth({ level, title, hint, children, onOpenChange }: {
  level: string;
  title: string;
  hint: string;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <details className="group rounded-xl border border-border bg-background/55"
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl p-3 marker:content-none hover:bg-foreground/5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">{level}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block text-xs text-muted">{hint}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="space-y-4 border-t border-border p-3 sm:p-4">{children}</div>
    </details>
  );
}

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

export default function SymbolDetailPanel({ ticker, onClose, focusRequest, isRefreshingToday = false, onRefreshToday, todayRefreshError }: SymbolDetailPanelProps) {
  const normalized = ticker.trim().toUpperCase();
  const selection = useWorkspaceStore((s) => s.selection);
  const selectionVersion = useWorkspaceStore((s) => s.selectionVersion);
  const setAnalysisTab = useWorkspaceStore((s) => s.setAnalysisTab);
  const analysisTab = useWorkspaceStore((s) => s.analysisTab);
  const [secondaryTab, setSecondaryTab] = useState<SecondaryTab | null>(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const headingId = useId();
  const researchId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setShowDraft(false); }, [normalized, selectionVersion]);

  // WorkspaceSelection envelope: the already-selected candidate snapshot travels
  // with the selection (CandidateQueue writes it). Never look the ticker back up
  // in the screener Last Run store here.
  const selectedCandidate =
    selection?.ticker === normalized ? (selection.candidate ?? null) : null;
  const benchmarkTicker = useScreenerStore((state) => {
    if (state.todayRun && selection?.source !== 'last_run' && selection?.runId === state.todayRun.completedAt) return state.todayRun.result.benchmarkTicker ?? null;
    if (selection?.source === 'last_run' && selection.runId === state.lastRunContext?.completedAt) return state.lastResult?.benchmarkTicker ?? null;
    return null;
  });
  const runRequest = useScreenerStore((state) => {
    if (state.todayRun && selection?.source !== 'last_run' && selection?.runId === state.todayRun.completedAt) return state.todayRun.request;
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
    screenerRun: candidate?.lastBar && (candidate.dataStatus === 'intraday' || candidate.dataStatus === 'current')
      ? { asOf: candidate.lastBar, freshness: candidate.dataStatus === 'current' ? 'final_close' : 'intraday' }
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

  useEffect(() => {
    const heading = headingRef.current;
    if (!focusRequest || !heading || useWorkspaceStore.getState().analysisTab === 'order') return;
    const bounds = heading.getBoundingClientRect();
    if (window.matchMedia?.('(max-width: 1279px)').matches || bounds.top < 0 || bounds.bottom > window.innerHeight) {
      heading.focus();
    }
  }, [focusRequest]);

  return (
    <aside
      data-testid="symbol-detail-panel"
      aria-labelledby={headingId}
      className="min-w-0 space-y-4 rounded-xl border border-primary/30 bg-surface p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary">{t('cockpit.detail.eyebrow')}</p>
          <h2 ref={headingRef} id={headingId} tabIndex={-1} className="mt-1 scroll-mt-6 break-all text-3xl font-bold tracking-tight">{normalized}</h2>
          {company ? <p className="mt-1 break-words text-sm text-muted">{company}</p> : null}
          {candidate?.recommendation ? (
            <div className="mt-1">
              <Badge variant={workflowBadgeVariant(workflowPresentation.tone)}>
                {t(workflowPresentation.labelKey)}
              </Badge>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onClose}
          aria-label={t('cockpit.detail.close')}
          title={t('cockpit.review.backToQueue')}
          className="shrink-0 gap-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          {t('cockpit.detail.close')}
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-3 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-xs text-primary" aria-hidden="true">01</span>
          {t('cockpit.detail.decisionLevel')}
        </h3>
        <AnalysisDecisionStrip
          ticker={normalized}
          disclosePlan
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

      <ReviewDepth level="02" title={t('cockpit.detail.marketLevel')} hint={t('cockpit.detail.marketHint')} onOpenChange={setMarketOpen}>
        {marketOpen ? (
          <>
            {candidate?.decisionSummary ? <DecisionWhyPanel summary={candidate.decisionSummary} recommendation={candidate.recommendation} /> : null}
            <CachedSymbolCandleChart ticker={normalized} candidate={candidate} benchmarkTicker={candidateAnalysis.benchmarkTicker} width={820} height={260} />
            <FundamentalsStrip
              trailingPe={fundamentals?.trailingPe}
              revenueGrowthYoy={fundamentals?.revenueGrowthYoy}
              grossMargin={fundamentals?.grossMargin}
              valuationLabel={candidate?.decisionSummary?.valuationLabel ?? null}
            />
            {candidate ? <TechnicalMetricsGrid candidate={candidate} /> : null}
          </>
        ) : null}
      </ReviewDepth>

      <ReviewDepth level="03" title={t('cockpit.detail.evidenceLevel')} hint={t('cockpit.detail.evidenceHint')}>
        <section className="space-y-2">
          <h3 className="font-semibold">{t('cockpit.detail.sourceDetails')}</h3>
          <dl className="divide-y divide-border rounded-lg border border-border bg-surface">
            {workspaceData.sourceStates.map((source) => (
              <div key={source.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                <dt className="font-medium">{t(`workspacePage.data.sources.${source.id}`)}</dt>
                <dd className="min-w-0 space-y-1 sm:text-right">
                  <Badge variant={source.phase === 'failed' ? 'error' : ['partial', 'stale'].includes(source.phase) ? 'warning' : 'default'}>
                    {t(`workspacePage.data.phases.${source.phase}`)}
                  </Badge>
                  {source.provider ? <p className="break-words text-xs text-muted">{source.provider}</p> : null}
                  {source.dataAsOf ? <p className="text-xs text-muted">{t('cockpit.detail.sourceAsOf', { date: source.dataAsOf })}</p> : null}
                  {source.fetchedAt ? <p className="text-xs text-muted">{t('cockpit.detail.sourceChecked', { time: formatDateTime(source.fetchedAt) })}</p> : null}
                  {source.error ? <p className="break-words text-xs text-danger">{source.error.message}</p> : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{t('cockpit.detail.ai')}</h3>
            {aiStale ? <Badge variant="warning">{t('cockpit.detail.aiStale')}</Badge> : null}
          </div>
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
            {displayedIntelligence?.summaryLine ?? t('workspacePage.intelligence.empty')}
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">{t('cockpit.detail.researchTools')}</h3>
          <div role="group" aria-label={t('cockpit.detail.researchTools')} className="flex flex-wrap gap-1">
            {(
              [
                { id: 'intelligence', label: t('workspacePage.panels.analysis.tabs.intelligence') },
                { id: 'backtest', label: t('workspacePage.panels.analysis.tabs.backtest') },
                { id: 'volumeZones', label: t('workspacePage.panels.analysis.tabs.volumeZones') },
              ] as const
            ).map((tool) => (
              <Button
                key={tool.id}
                type="button"
                variant={secondaryTab === tool.id ? 'primary' : 'secondary'}
                size="sm"
                aria-expanded={secondaryTab === tool.id}
                aria-controls={researchId}
                onClick={() => setSecondaryTab((current) => (current === tool.id ? null : tool.id))}
              >
                {tool.label}
              </Button>
            ))}
          </div>
          <div id={researchId}>
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
                  trace: runTrace.data?.ticker.trim().toUpperCase() === normalized ? runTrace.data : null,
                  isLoadingAnalysis: isIntelligenceLoading,
                  isCachedAnalysis: !intelligenceResult && intelligenceQuery.isFetchedAfterMount === false,
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
              <VolumeZonesTab ticker={normalized} sources={workspaceData.sourceStates.filter(({ id }) => id === 'prices' || id === 'screener')} />
            ) : null}
          </div>
        </section>
      </ReviewDepth>
    </aside>
  );
}
