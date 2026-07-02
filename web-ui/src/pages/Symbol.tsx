import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import SymbolAnalysisContent from '@/components/domain/workspace/SymbolAnalysisContent';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import { syncCandidateWithFundamentals } from '@/features/screener/decisionSummary';
import { useFundamentalSnapshotQuery } from '@/features/fundamentals/hooks';
import type { WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import { useScreenerStore } from '@/stores/screenerStore';
import { useOpenPositions } from '@/features/portfolio/hooks';

export default function Symbol() {
  const params = useParams<{ ticker: string }>();
  const ticker = params.ticker?.trim().toUpperCase();

  const [analysisTab, setAnalysisTab] = useState<WorkspaceAnalysisTab>('overview');

  const candidate = useScreenerStore((s) =>
    ticker ? (s.lastResult?.candidates.find((c) => c.ticker === ticker) ?? null) : null
  );
  const patchCandidate = useScreenerStore((s) => s.patchCandidate);
  const positionsQuery = useOpenPositions();
  const position = ticker
    ? (positionsQuery.data?.find((p) => p.ticker === ticker) ?? null)
    : null;

  const fundamentalsQuery = useFundamentalSnapshotQuery(
    analysisTab === 'fundamentals' ? ticker ?? undefined : undefined
  );
  const latestFundamentalsSnapshot = fundamentalsQuery.data;

  // Fundamentals→candidate live-sync: ported VERBATIM from
  // SymbolDrawer.tsx:33-47 (adjusted variable names to this component's).
  useEffect(() => {
    if (!ticker || !candidate || !latestFundamentalsSnapshot) {
      return;
    }

    if (latestFundamentalsSnapshot.symbol.trim().toUpperCase() !== ticker.trim().toUpperCase()) {
      return;
    }

    if (syncCandidateWithFundamentals(candidate, latestFundamentalsSnapshot) === candidate) {
      return;
    }

    patchCandidate(ticker, (c) => syncCandidateWithFundamentals(c, latestFundamentalsSnapshot));
  }, [latestFundamentalsSnapshot, patchCandidate, candidate, ticker]);

  if (!ticker) {
    return <Navigate to="/today" replace />;
  }

  return (
    <div>
      <PageHeader title={ticker} />
      <SymbolAnalysisContent
        ticker={ticker}
        candidate={candidate}
        position={position}
        activeTab={analysisTab}
        onTabChange={setAnalysisTab}
        orderPanel={<ActionPanel ticker={ticker} />}
      />
    </div>
  );
}
