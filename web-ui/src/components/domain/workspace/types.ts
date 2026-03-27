import type { Recommendation } from '@/types/recommendation';
import type { DecisionSummary, SameSymbolCandidateContext } from '@/features/screener/types';

export type WorkspaceAnalysisTab = 'overview' | 'fundamentals' | 'intelligence' | 'order';

export interface SymbolAnalysisCandidate {
  ticker: string;
  currency?: 'USD' | 'EUR';
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
}
