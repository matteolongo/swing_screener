export type CatalystOpportunityState =
  | 'CATALYST_ACTIVE'
  | 'TRENDING'
  | 'WATCH'
  | 'COOLING_OFF'
  | 'QUIET';

export interface CatalystOpportunityAPI {
  ticker: string;
  state: CatalystOpportunityState;
  catalyst_strength: number;
  thesis: string;
  key_risks: string[];
  sources: string[];
  report_id: string;
  generated_at: string;
}

export interface CatalystOpportunity {
  ticker: string;
  state: CatalystOpportunityState;
  catalystStrength: number;
  thesis: string;
  keyRisks: string[];
  sources: string[];
  reportId: string;
  generatedAt: string;
}

export function transformCatalystOpportunity(api: CatalystOpportunityAPI): CatalystOpportunity {
  return {
    ticker: api.ticker,
    state: api.state,
    catalystStrength: api.catalyst_strength,
    thesis: api.thesis,
    keyRisks: api.key_risks,
    sources: api.sources,
    reportId: api.report_id,
    generatedAt: api.generated_at,
  };
}

export interface MarketThemeAPI {
  name: string;
  summary: string;
  time_horizon: 'short_term' | 'medium_term' | 'long_term';
  confidence: number;
}

export interface MarketTheme {
  name: string;
  summary: string;
  timeHorizon: 'short_term' | 'medium_term' | 'long_term';
  confidence: number;
}

export interface CatalystReportAPI {
  report_id: string;
  event_summary: string;
  themes: MarketThemeAPI[];
  // TODO(Task 9): type CausalChainStep and CompanyCatalyst when rendering beneficiaries/losers
  causal_chains: unknown[];
  beneficiaries: unknown[];
  losers: unknown[];
  hidden_opportunities: unknown[];
  non_actionable_notes: string[];
  generated_at: string;
}

export interface CatalystReport {
  reportId: string;
  eventSummary: string;
  themes: MarketTheme[];
  nonActionableNotes: string[];
  generatedAt: string;
}

export function transformCatalystReport(api: CatalystReportAPI): CatalystReport {
  return {
    reportId: api.report_id,
    eventSummary: api.event_summary,
    themes: api.themes.map((t) => ({
      name: t.name,
      summary: t.summary,
      timeHorizon: t.time_horizon,
      confidence: t.confidence,
    })),
    nonActionableNotes: api.non_actionable_notes,
    generatedAt: api.generated_at,
  };
}
