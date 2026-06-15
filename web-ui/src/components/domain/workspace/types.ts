import type { Recommendation } from '@/types/recommendation';
import type {
  CandidateDataSourceSummary,
  CandlePattern,
  DecisionSummary,
  SameSymbolCandidateContext,
} from '@/features/screener/types';

export type WorkspaceAnalysisTab = 'overview' | 'fundamentals' | 'order';

export interface SymbolAnalysisCandidate {
  ticker: string;
  currency?: string;
  name?: string | null;
  sector?: string | null;
  close?: number;
  score?: number;
  confidence?: number;
  rank?: number;
  atr?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
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
