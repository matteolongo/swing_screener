import { useEffect, useRef, useState } from 'react';

import Card from '@/components/common/Card';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import DataStatusBar from '@/components/domain/workspace/DataStatusBar';
import SymbolWorkspaceHeader from '@/components/domain/workspace/SymbolWorkspaceHeader';
import SymbolAnalysisContent from '@/components/domain/workspace/SymbolAnalysisContent';
import WorkspaceActivityDrawer from '@/components/domain/workspace/WorkspaceActivityDrawer';
import { useOpenPositions } from '@/features/portfolio/hooks';
import { useSymbolWorkspaceData } from '@/features/workspaceData/useSymbolWorkspaceData';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import type { WorkspaceSourceId } from '@/features/workspaceData/types';
import type { EvidenceRefreshResponse } from '@/features/intelligence/types';

export default function AnalysisCanvasPanel() {
  const [selectedSourceId, setSelectedSourceId] = useState<WorkspaceSourceId | null>(null);
  const [evidenceRefresh, setEvidenceRefresh] = useState<EvidenceRefreshResponse | null>(null);
  const evidenceRefreshActionRef = useRef<(() => void) | null>(null);
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const activeTab = useWorkspaceStore((state) => state.analysisTab);
  const selectionVersion = useWorkspaceStore((state) => state.selectionVersion);
  const fullscreen = useWorkspaceStore((state) => state.fullscreen);
  const activities = useWorkspaceStore((state) => state.activities);
  const activityDrawerOpen = useWorkspaceStore((state) => state.activityDrawerOpen);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const clearSelectedTicker = useWorkspaceStore((state) => state.clearSelectedTicker);
  const collapseWorkspace = useWorkspaceStore((state) => state.collapseWorkspace);
  const setFullscreen = useWorkspaceStore((state) => state.setFullscreen);
  const setActivityDrawerOpen = useWorkspaceStore((state) => state.setActivityDrawerOpen);
  const dismissActivity = useWorkspaceStore((state) => state.dismissActivity);
  const markActivityAnnounced = useWorkspaceStore((state) => state.markActivityAnnounced);
  const lastScreenerResult = useScreenerStore((state) => state.lastResult);
  const selectedCandidate = lastScreenerResult?.candidates.find(
    (candidate) => candidate.ticker.toUpperCase() === selectedTicker?.toUpperCase()
  );
  const openPositionsQuery = useOpenPositions();
  const openPosition = openPositionsQuery.data?.find(
    (p) => p.ticker.toUpperCase() === selectedTicker?.toUpperCase()
  ) ?? null;
  const visibleActivities = selectedTicker
    ? activities.filter(
        (activity) => activity.ticker === selectedTicker.toUpperCase()
          && activity.selectionVersion === selectionVersion,
      )
    : [];

  useEffect(() => {
    setEvidenceRefresh(null);
  }, [selectedTicker, selectionVersion]);

  const workspaceData = useSymbolWorkspaceData({
    ticker: selectedTicker ?? '',
    selectionVersion,
    candidate: selectedCandidate ?? null,
    position: openPosition,
    screenerRun: selectedCandidate && lastScreenerResult
      ? { asOf: lastScreenerResult.asofDate, freshness: lastScreenerResult.dataFreshness }
      : null,
    evidenceRefresh,
    refreshEvidence: () => evidenceRefreshActionRef.current?.(),
  });
  return (
    <Card
      id="workspace-analysis-canvas"
      variant="bordered"
      className="p-3 md:p-4 flex min-h-0 flex-col gap-3 xl:h-full"
    >
      {!selectedTicker ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center gap-3">
          <div className="text-4xl select-none">📊</div>
          <p className="text-sm font-medium text-muted">
            {t('workspacePage.panels.analysis.empty')}
          </p>
          <p className="text-xs text-muted max-w-xs">
            {t('workspacePage.emptyDescription')}
          </p>
        </div>
      ) : (
        <>
          <SymbolWorkspaceHeader
            ticker={selectedTicker}
            companyName={workspaceData.fundamentals.data?.companyName ?? selectedCandidate?.name}
            mode={openPosition ? 'position' : selectedCandidate ? 'candidate' : 'research'}
            runAsOf={selectedCandidate ? lastScreenerResult?.asofDate ?? null : null}
            runFreshness={selectedCandidate ? lastScreenerResult?.dataFreshness ?? null : null}
            health={workspaceData.health}
            isRefreshing={
              workspaceData.fundamentalsRefreshing
              || workspaceData.sourceStates.some(
                ({ id, phase }) =>
                  (id === 'fundamentals' || id === 'prices' || id === 'positionOrders')
                  && phase === 'loading',
              )
            }
            onRefreshAll={() => {
              void workspaceData.refreshAllNonIntelligence().catch(() => undefined);
            }}
            fullscreen={fullscreen}
            onClose={clearSelectedTicker}
            onCollapse={collapseWorkspace}
            onFullscreenChange={setFullscreen}
          />
          <DataStatusBar
            sources={workspaceData.sourceStates}
            onSourceSelect={(sourceId) => {
              setSelectedSourceId(sourceId);
              setActivityDrawerOpen(true);
            }}
          />
          {activityDrawerOpen ? (
            <WorkspaceActivityDrawer
              activities={visibleActivities}
              selectedSource={workspaceData.sourceStates.find(({ id }) => id === selectedSourceId)}
              onRetry={(sourceId) => {
                void workspaceData.refreshSource(sourceId).catch(() => undefined);
              }}
              onDismiss={dismissActivity}
              onMarkAnnounced={markActivityAnnounced}
            />
          ) : null}
          <SymbolAnalysisContent
            ticker={selectedTicker}
            selectionVersion={selectionVersion}
            candidate={selectedCandidate}
            position={openPosition}
            activeTab={activeTab}
            onTabChange={setAnalysisTab}
            orderPanel={
              <ActionPanel
                ticker={selectedTicker}
                source={workspaceData.sourceStates.find(({ id }) => id === 'positionOrders')}
              />
            }
            intelligenceOutdated={workspaceData.intelligenceOutdated}
            intelligenceWorkflow={{
              sources: workspaceData.sourceStates,
              onEvidenceRefresh: setEvidenceRefresh,
              evidenceRefreshActionRef,
            }}
            fundamentals={{
              data: workspaceData.fundamentals.data,
              isLoading: workspaceData.fundamentals.isLoading,
              isFetching: workspaceData.fundamentals.isFetching,
              isError: workspaceData.fundamentals.isError,
              error: workspaceData.fundamentals.error,
              isRefreshing: workspaceData.fundamentalsRefreshing,
              refreshError: workspaceData.fundamentalsRefreshError,
              onRefresh: () => {
                void workspaceData.refreshSource('fundamentals').catch(() => undefined);
              },
            }}
          />
        </>
      )}
    </Card>
  );
}
