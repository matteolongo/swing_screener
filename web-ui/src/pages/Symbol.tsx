import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import SymbolAnalysisContent from '@/components/domain/workspace/SymbolAnalysisContent';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import { useSymbolFundamentalsSync } from '@/features/fundamentals/useSymbolFundamentalsSync';
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
  const positionsQuery = useOpenPositions();
  const position = ticker
    ? (positionsQuery.data?.find((p) => p.ticker === ticker) ?? null)
    : null;

  useSymbolFundamentalsSync(ticker ?? null, candidate);

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
