import type { DecisionAction, DecisionConviction } from '@/features/screener/types';

export type { DecisionAction, DecisionConviction };

export interface SymbolIntelligenceAPI {
  symbol: string;
  generated_at: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  summary_line: string;
  narrative: string;
  sources: string[];
}

export interface SymbolIntelligence {
  symbol: string;
  generatedAt: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  summaryLine: string;
  narrative: string;
  sources: string[];
}

export function transformIntelligence(api: SymbolIntelligenceAPI): SymbolIntelligence {
  return {
    symbol: api.symbol,
    generatedAt: api.generated_at,
    action: api.action,
    conviction: api.conviction,
    summaryLine: api.summary_line,
    narrative: api.narrative,
    sources: api.sources,
  };
}
