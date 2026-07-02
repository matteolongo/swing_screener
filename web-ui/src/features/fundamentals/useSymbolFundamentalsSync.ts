import { useEffect } from 'react';

import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { syncCandidateWithFundamentals } from '@/features/screener/decisionSummary';
import { useFundamentalSnapshotQuery, useRefreshFundamentalSnapshotMutation } from '@/features/fundamentals/hooks';
import type { ScreenerCandidate } from '@/features/screener/types';
import { useScreenerStore } from '@/stores/screenerStore';

// Fundamentals→candidate live-sync: extracted from the former Today
// analysis-canvas component (originally duplicated in SymbolDrawer.tsx and
// pages/Symbol.tsx). Keeps a screener candidate's decisionSummary in step with
// the latest fundamentals snapshot for the symbol currently on screen.
export function useSymbolFundamentalsSync(
  ticker: string | null,
  candidate: SymbolAnalysisCandidate | null,
) {
  const patchCandidate = useScreenerStore((s) => s.patchCandidate);
  const fundamentalsQuery = useFundamentalSnapshotQuery(ticker ?? undefined);
  const refreshFundamentalsMutation = useRefreshFundamentalSnapshotMutation();
  const latestFundamentalsSnapshot = refreshFundamentalsMutation.data ?? fundamentalsQuery.data;

  useEffect(() => {
    if (!ticker || !candidate || !latestFundamentalsSnapshot) {
      return;
    }

    if (latestFundamentalsSnapshot.symbol.trim().toUpperCase() !== ticker.trim().toUpperCase()) {
      return;
    }

    // Callers always source `candidate` from the screener store (a ScreenerCandidate);
    // the wider SymbolAnalysisCandidate param type only reflects what this hook needs
    // to read, matching the prop type SymbolAnalysisContent accepts downstream.
    const screenerCandidate = candidate as ScreenerCandidate;

    if (syncCandidateWithFundamentals(screenerCandidate, latestFundamentalsSnapshot) === screenerCandidate) {
      return;
    }

    patchCandidate(ticker, (c) => syncCandidateWithFundamentals(c, latestFundamentalsSnapshot));
  }, [latestFundamentalsSnapshot, patchCandidate, candidate, ticker]);
}
