import { useEffect } from 'react';

import Card from '@/components/common/Card';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import SymbolAnalysisContent from '@/components/domain/workspace/SymbolAnalysisContent';
import SymbolNoteWidget from '@/components/domain/workspace/SymbolNoteWidget';
import { syncCandidateWithFundamentals } from '@/features/screener/decisionSummary';
import type { SymbolIntelligenceStatus } from '@/features/intelligence/useSymbolIntelligenceRunner';
import { useFundamentalSnapshotQuery, useRefreshFundamentalSnapshotMutation } from '@/features/fundamentals/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';

interface AnalysisCanvasPanelProps {
  onRunSymbolIntelligence?: (ticker: string) => void;
  symbolIntelligenceStatus?: SymbolIntelligenceStatus;
}

export default function AnalysisCanvasPanel({
  onRunSymbolIntelligence,
  symbolIntelligenceStatus,
}: AnalysisCanvasPanelProps) {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const activeTab = useWorkspaceStore((state) => state.analysisTab);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const lastScreenerResult = useScreenerStore((state) => state.lastResult);
  const patchCandidate = useScreenerStore((state) => state.patchCandidate);
  const selectedCandidate = lastScreenerResult?.candidates.find(
    (candidate) => candidate.ticker.toUpperCase() === selectedTicker?.toUpperCase()
  );

  const fundamentalsQuery = useFundamentalSnapshotQuery(
    activeTab === 'fundamentals' ? selectedTicker ?? undefined : undefined
  );
  const refreshFundamentalsMutation = useRefreshFundamentalSnapshotMutation();
  const latestFundamentalsSnapshot = refreshFundamentalsMutation.data ?? fundamentalsQuery.data;

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
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center gap-3">
          <div className="text-4xl select-none">📊</div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('workspacePage.panels.analysis.empty')}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
            Run the screener and select a symbol to see its analysis, trade plan, and intelligence.
          </p>
        </div>
      ) : (
        <>
          <SymbolAnalysisContent
            ticker={selectedTicker}
            candidate={selectedCandidate}
            activeTab={activeTab}
            onTabChange={setAnalysisTab}
            orderPanel={<ActionPanel ticker={selectedTicker} />}
            onRunSymbolIntelligence={onRunSymbolIntelligence}
            symbolIntelligenceStatus={symbolIntelligenceStatus}
          />
          <SymbolNoteWidget ticker={selectedTicker} />
        </>
      )}
    </Card>
  );
}
