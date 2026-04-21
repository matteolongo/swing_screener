import type { Recommendation } from '@/types/recommendation';
import type { DecisionSummary, SameSymbolCandidateContext, PriorTradeContext, ReentryGateResult } from '@/features/screener/types';

export type WorkspaceAnalysisTab = 'overview' | 'fundamentals' | 'intelligence' | 'order' | 'history';

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
  priorTrades?: PriorTradeContext;
  reentryGate?: ReentryGateResult;
}
