import { useEffect } from 'react';

import Card from '@/components/common/Card';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import DataStatusBar from '@/components/domain/workspace/DataStatusBar';
import SymbolWorkspaceHeader from '@/components/domain/workspace/SymbolWorkspaceHeader';
import SymbolAnalysisContent from '@/components/domain/workspace/SymbolAnalysisContent';
import WorkspaceActivityDrawer from '@/components/domain/workspace/WorkspaceActivityDrawer';
import { useRefreshFundamentalSnapshotMutation } from '@/features/fundamentals/hooks';
import { syncCandidateWithFundamentals } from '@/features/screener/decisionSummary';
import { useOpenPositions } from '@/features/portfolio/hooks';
import { useSymbolWorkspaceData } from '@/features/workspaceData/useSymbolWorkspaceData';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';

export default function AnalysisCanvasPanel() {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const activeTab = useWorkspaceStore((state) => state.analysisTab);
  const selectionVersion = useWorkspaceStore((state) => state.selectionVersion);
  const fullscreen = useWorkspaceStore((state) => state.fullscreen);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const clearSelectedTicker = useWorkspaceStore((state) => state.clearSelectedTicker);
  const collapseWorkspace = useWorkspaceStore((state) => state.collapseWorkspace);
  const setFullscreen = useWorkspaceStore((state) => state.setFullscreen);
  const lastScreenerResult = useScreenerStore((state) => state.lastResult);
  const patchCandidate = useScreenerStore((state) => state.patchCandidate);
  const selectedCandidate = lastScreenerResult?.candidates.find(
    (candidate) => candidate.ticker.toUpperCase() === selectedTicker?.toUpperCase()
  );
  const openPositionsQuery = useOpenPositions();
  const openPosition = openPositionsQuery.data?.find(
    (p) => p.ticker.toUpperCase() === selectedTicker?.toUpperCase()
  ) ?? null;

  const workspaceData = useSymbolWorkspaceData({
    ticker: selectedTicker ?? '',
    selectionVersion,
    candidate: selectedCandidate ?? null,
    position: openPosition,
  });
  const refreshFundamentalsMutation = useRefreshFundamentalSnapshotMutation();
  const latestFundamentalsSnapshot =
    refreshFundamentalsMutation.data ?? workspaceData.fundamentals.data;

  useEffect(() => {
    if (!selectedTicker || !selectedCandidate || !latestFundamentalsSnapshot) {
      return;
    }

    if (latestFundamentalsSnapshot.symbol.trim().toUpperCase() !== selectedTicker.trim().toUpperCase()) {
      return;
    }

    if (syncCandidateWithFundamentals(selectedCandidate, latestFundamentalsSnapshot) === selectedCandidate) {
      return;
    }

    patchCandidate(selectedTicker, (candidate) => syncCandidateWithFundamentals(candidate, latestFundamentalsSnapshot));
  }, [latestFundamentalsSnapshot, patchCandidate, selectedCandidate, selectedTicker]);

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
            Run the screener and select a symbol to see its analysis, trade plan, and intelligence.
          </p>
        </div>
      ) : (
        <>
          <SymbolWorkspaceHeader
            ticker={selectedTicker}
            fullscreen={fullscreen}
            onClose={clearSelectedTicker}
            onCollapse={collapseWorkspace}
            onFullscreenChange={setFullscreen}
          />
          <DataStatusBar sources={workspaceData.sourceStates} />
          <WorkspaceActivityDrawer
            activities={workspaceData.sourceStates}
            onRetry={(sourceId) => void workspaceData.refreshSource(sourceId)}
          />
          <SymbolAnalysisContent
            ticker={selectedTicker}
            candidate={selectedCandidate}
            position={openPosition}
            activeTab={activeTab}
            onTabChange={setAnalysisTab}
            orderPanel={<ActionPanel ticker={selectedTicker} />}
            intelligenceOutdated={workspaceData.intelligenceOutdated}
          />
        </>
      )}
    </Card>
  );
}
