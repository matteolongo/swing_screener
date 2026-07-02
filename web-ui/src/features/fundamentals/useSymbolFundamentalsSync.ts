import { useEffect } from 'react';

import { syncCandidateWithFundamentals } from '@/features/screener/decisionSummary';
import { useFundamentalSnapshotQuery } from '@/features/fundamentals/hooks';
import type { ScreenerCandidate } from '@/features/screener/types';
import { useScreenerStore } from '@/stores/screenerStore';

// Fundamentals→candidate live-sync: extracted from the former Today
// analysis-canvas component (originally duplicated in SymbolDrawer.tsx and
// pages/Symbol.tsx). Keeps a screener candidate's decisionSummary in step with
// the latest fundamentals snapshot for the symbol currently on screen.
export function useSymbolFundamentalsSync(
  ticker: string | null,
  candidate: ScreenerCandidate | null,
) {
  const patchCandidate = useScreenerStore((s) => s.patchCandidate);
  const fundamentalsQuery = useFundamentalSnapshotQuery(ticker ?? undefined);
  const latestFundamentalsSnapshot = fundamentalsQuery.data;

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
}
