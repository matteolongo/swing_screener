import { useState } from 'react';
import Badge from '@/components/common/Badge';
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
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { useFundamentalSnapshotQuery } from '@/features/fundamentals/hooks';
import { useIntelligenceLatestQuery } from '@/features/intelligence/hooks';
import { useOpenPositions } from '@/features/portfolio/hooks';
import { getCanonicalOrderDraft } from '@/features/screener/types';
import {
  useUnwatchSymbolMutation,
  useWatchlist,
  useWatchSymbolMutation,
} from '@/features/watchlist/hooks';
import { t } from '@/i18n/t';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface SymbolDetailPanelProps {
  ticker: string;
  onClose: () => void;
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

export default function SymbolDetailPanel({ ticker, onClose }: SymbolDetailPanelProps) {
  const normalized = ticker.trim().toUpperCase();
  const selection = useWorkspaceStore((s) => s.selection);
  const selectionVersion = useWorkspaceStore((s) => s.selectionVersion);
  const setAnalysisTab = useWorkspaceStore((s) => s.setAnalysisTab);
  const [secondaryTab, setSecondaryTab] = useState<SecondaryTab | null>(null);

  // WorkspaceSelection envelope: the already-selected candidate snapshot travels
  // with the selection (CandidateQueue writes it). Never look the ticker back up
  // in the screener Last Run store here.
  const candidate: SymbolAnalysisCandidate | null =
    selection?.ticker === normalized ? (selection.candidate ?? null) : null;

  const openPositionsQuery = useOpenPositions();
  const position =
    openPositionsQuery.data?.find((p) => p.ticker.toUpperCase() === normalized) ?? null;

  const fundamentalsQuery = useFundamentalSnapshotQuery(normalized);
  const fundamentals = fundamentalsQuery.data ?? null;
  const intelligenceQuery = useIntelligenceLatestQuery(normalized, Boolean(normalized));
  const intelligence = intelligenceQuery.data ?? null;

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

  const orderDraft = getCanonicalOrderDraft(candidate);
  const canReviewOrder = Boolean(orderDraft);

  const workflowPresentation = getWorkflowPresentation(candidate?.recommendation);
  const company = candidate?.name ?? fundamentals?.companyName ?? null;

  const aiStale =
    fundamentals != null &&
    intelligence != null &&
    Number.isFinite(Date.parse(fundamentals.updatedAt)) &&
    Number.isFinite(Date.parse(intelligence.generatedAt)) &&
    Date.parse(fundamentals.updatedAt) > Date.parse(intelligence.generatedAt);

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
        />
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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t('cockpit.detail.chart')}</h2>
        <div className="rounded-lg border border-border bg-surface p-3">
          <CachedSymbolCandleChart ticker={normalized} width={820} height={220} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t('cockpit.detail.ai')}</h2>
        {aiStale ? (
          <div>
            <Badge variant="warning">{t('cockpit.detail.aiStale')}</Badge>
          </div>
        ) : null}
        {intelligence ? (
          <NarrativeAnalysisCard
            intelligence={intelligence}
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
              analysis: intelligence,
              intelligenceOutdated: aiStale,
              sources: [],
              trace: null,
              isLoadingAnalysis: intelligenceQuery.isLoading,
              isCachedAnalysis: false,
              isGenerating: false,
              isRefreshingEvidence: false,
              generationError: null,
              failedGenerationForce: false,
              refreshError: null,
              refreshedEvidence: null,
              onRefreshEvidence: () => undefined,
              onGenerate: () => undefined,
            }}
          />
        ) : null}
        {secondaryTab === 'backtest' ? <SymbolBacktestTab ticker={normalized} /> : null}
        {secondaryTab === 'volumeZones' ? <VolumeZonesTab ticker={normalized} /> : null}
      </div>
    </div>
  );
}
