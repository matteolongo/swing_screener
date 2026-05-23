import type { DecisionAction, DecisionConviction } from '@/features/screener/types';

export type { DecisionAction, DecisionConviction };

export type CatalystUrgency = 'high' | 'medium' | 'low' | 'none';
export type IntelligenceEventDirection = 'bullish' | 'bearish' | 'neutral';
export type IntelligenceEventType = 'earnings' | 'macro' | 'dividend' | 'product_launch' | 'regulatory' | 'other';
export type PositionSignalAction = 'HOLD' | 'TRIM' | 'EXIT';

export interface IntelligenceEvent {
  type: IntelligenceEventType;
  date: string | null;
  direction: IntelligenceEventDirection;
  summary: string;
}

export interface PositionSignal {
  action: PositionSignalAction;
  reason: string;
}

export interface SymbolIntelligenceAPI {
  symbol: string;
  generated_at: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  catalyst_urgency: CatalystUrgency;
  summary_line: string;
  narrative: string;
  upcoming_events: IntelligenceEvent[];
  position_signal: PositionSignal | null;
  sources: string[];
}

export interface SymbolIntelligence {
  symbol: string;
  generatedAt: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  catalystUrgency: CatalystUrgency;
  summaryLine: string;
  narrative: string;
  upcomingEvents: IntelligenceEvent[];
  positionSignal: PositionSignal | null;
  sources: string[];
}

export function transformIntelligence(api: SymbolIntelligenceAPI): SymbolIntelligence {
  return {
    symbol: api.symbol,
    generatedAt: api.generated_at,
    action: api.action,
    conviction: api.conviction,
    catalystUrgency: api.catalyst_urgency,
    summaryLine: api.summary_line,
    narrative: api.narrative,
    upcomingEvents: api.upcoming_events ?? [],
    positionSignal: api.position_signal ?? null,
    sources: api.sources ?? [],
  };
}

export interface SweepSymbolPayload {
  ticker: string;
  request: {
    close: number;
    signal: string;
    entry?: number | null;
    stop?: number | null;
    sma_20?: number | null;
    sma_50?: number | null;
    sma_200?: number | null;
    momentum_6m?: number | null;
    momentum_12m?: number | null;
    sector?: string | null;
    currency?: string;
    entry_price?: number | null;
    r_now?: number | null;
    days_open?: number | null;
  };
}

export interface SweepResponseAPI {
  analyzed: string[];
  failed: Array<{ ticker: string; error: string }>;
}
