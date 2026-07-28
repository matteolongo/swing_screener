export interface TaxonomyFilter {
  region?: string;
  market_cap_tier?: string;
  sector?: string;
  index_memberships?: string[];
  instrument_type?: string;
  instrument_type_detail?: string;
  provider?: string;
  currency?: string;
  exchange_mics?: string[];
  liquidity_tier?: string;
}

export interface CandidateRow {
  rank: number;
  symbol: string;
  exchange_mic: string;
  setup: string;
  entry: number;
  stop: number;
  rr: number;
  risk_usd: number;
  shares: number;
  sector: string;
  price: number;
  close: number;
  catalyst?: string;
  gain?: number;
  held?: number;
}

export interface ScreenerResult {
  candidates: CandidateRow[];
  universe: string;
  generated_at: string;
  freshness: 'final_close' | 'intraday';
}

export interface WatchlistItem {
  symbol: string;
  exchange_mic: string;
  price: number;
  change_pct: number;
  setup?: string;
  rr?: number;
  sector: string;
  held?: number;
}

export interface AIAnalysis {
  ticker: string;
  generated_at: string;
  thesis: string;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  evidence_ledger?: Record<string, unknown>;
  classified_catalysts?: Record<string, unknown>;
  predictions?: Record<string, unknown>;
  pre_open_outlook?: string;
  thesis_status?: string;
  news?: Array<Record<string, unknown>>;
  source_citations?: Array<Record<string, unknown>>;
}

export interface HistoryEntry {
  generated_at: string;
  action: string;
  conviction: string;
  summary_line: string;
  watch_for: string;
  pre_open_outlook?: string;
  predictions?: Record<string, unknown>;
}

export interface Position {
  position_id: string;
  ticker: string;
  direction: string;
  entry_price: number;
  current_price: number;
  shares: number;
  market_value: number;
  unrealized_pl: number;
  rr_to_target: number;
  distance_to_stop: number;
  trail_method: string;
  trail_level?: number;
  last_exhaustion_score?: number;
  last_exhaustion_label?: string;
  target_price: number;
  entry_fee_eur?: number;
  exit_fee_eur?: number;
}

export interface OrderDraft {
  ticker: string;
  side: string;
  order_type: string;
  shares: number;
  entry_price: number;
  stop_price: number;
  target_price: number;
  risk_1r: number;
  rr: number;
  risk_usd: number;
  position_value: number;
  pct_of_account: number;
  est_fees?: number;
  fee_gate_pass: boolean;
  concentration_warning?: string;
}

export interface KPI {
  label: string;
  value: string | number;
  detail?: string;
}

export interface AlertItem {
  id: string;
  type: string;
  symbol?: string;
  message: string;
  timestamp: string;
}

export interface StepStatus {
  name: string;
  status: 'done' | 'pending' | 'skipped';
}

export interface DailyReview {
  kpis: KPI[];
  positions: Position[];
  candidates: CandidateRow[];
  alerts: AlertItem[];
  steps: StepStatus[];
}

export interface PriceHistoryPoint {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface PatternAnnotation {
  bar_index: number;
  date: string;
  name: string;
  direction: string;
  key_level: number;
  context: string;
  volume_ratio?: number;
  bar_pressure?: number;
  volume_confirmed?: boolean;
}

export interface PoolSymbol {
  symbol: string;
  exchange_mic?: string;
  currency?: string;
  region?: string;
  instrument_type?: string;
  sector?: string;
  market_cap_tier?: string;
  liquidity_tier?: string;
}

export interface SymbolPoolResponse {
  symbols: PoolSymbol[];
  total: number;
  page: number;
  page_size: number;
}

export interface PoolPreset {
  id: string;
  label: string;
  filter: TaxonomyFilter;
}

export interface PoolPresetsResponse {
  presets: PoolPreset[];
}

export interface ApiError {
  error: string;
  detail?: string;
  status: number;
}
