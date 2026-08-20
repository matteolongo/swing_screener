import type { Recommendation } from '@/types/recommendation';
import type {
  CandidateDataSourceSummary,
  CandlePattern,
  DecisionSummary,
  SameSymbolCandidateContext,
} from '@/features/screener/types';

export type WorkspaceAnalysisTab =
  | 'overview'
  | 'fundamentals'
  | 'intelligence'
  | 'order'
  | 'backtest'
  | 'volumeZones';

export interface SymbolAnalysisCandidate {
  ticker: string;
  currency?: string;
  name?: string | null;
  sector?: string | null;
  close?: number;
  score?: number;
  confidence?: number;
  rank?: number;
  fundamentalsFreshnessStatus?: string;
  fundamentalsAsOf?: string;
  lastBar?: string;
  dataStatus?: 'current' | 'stale' | 'intraday' | 'unknown';
  atr?: number;
  sma20?: number | null;
  sma50?: number | null;
  sma200?: number | null;
  momentum6m?: number;
  momentum12m?: number;
  relStrength?: number;
  sectorRs?: number;
  dist52wHighPct?: number | null;
  near52wHigh?: boolean | null;
  signal?: string;
  entry?: number;
  stop?: number;
  shares?: number;
  rr?: number;
  rReward?: number;
  recommendation?: Recommendation;
  suggestedOrderType?: string;
  approvalToken?: string;
  suggestedOrderPrice?: number;
  executionNote?: string;
  sameSymbol?: SameSymbolCandidateContext;
  decisionSummary?: DecisionSummary;
  sectorRotationContext?: Record<string, unknown> | null;
  dataSourceSummary?: CandidateDataSourceSummary;
  daysToEarnings?: number | null;
  patterns?: CandlePattern[];
  patternStop?: number | null;
  patternStopReason?: string | null;
}
