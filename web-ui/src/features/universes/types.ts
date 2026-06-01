import type { UniverseSourceDocument, UniverseSummary } from '@/features/screener/types';

export interface UniverseRuleSet {
  exchange_mics?: string[];
  currencies?: string[];
}

export interface UniverseConstituent {
  symbol: string;
  source_name?: string;
  source_symbol?: string;
  exchange_mic?: string;
  currency?: string;
  instrument_type?: string;
  status?: string;
  primary_listing?: boolean;
}

export interface UniverseDetail extends UniverseSummary {
  rules: UniverseRuleSet;
  validation_errors: string[];
  constituents: UniverseConstituent[];
}

export interface UniverseRefreshPreview {
  universe: UniverseSummary;
  applied: boolean;
  changed: boolean;
  current_member_count: number;
  proposed_member_count: number;
  additions: string[];
  removals: string[];
  notes: string[];
}

export interface SymbolDiscoveryRequest {
  provider: 'yahoo_predefined' | 'eodhd_exchange';
  screens: string[];
  exchanges: string[];
  currencies: string[];
  exchange_mics: string[];
  quote_types: string[];
  limit: number;
  min_market_cap?: number | null;
  min_volume?: number | null;
}

export interface DiscoveredSymbol {
  symbol: string;
  name?: string | null;
  instrument_type?: string | null;
  currency?: string | null;
  market?: string | null;
  exchange_mic?: string | null;
  provider_exchange?: string | null;
  exchange_name?: string | null;
  market_cap?: number | null;
  volume?: number | null;
  sector?: string | null;
  industry?: string | null;
  source?: string | null;
  source_screen?: string | null;
  discovery_rank?: number | null;
}

export interface SymbolDiscoveryResponse {
  provider: SymbolDiscoveryRequest['provider'];
  source_asof: string;
  source_documents: UniverseSourceDocument[];
  filters: Record<string, unknown>;
  symbols: DiscoveredSymbol[];
  taxonomy: Record<string, Record<string, number>>;
  notes: string[];
}

export type { UniverseSourceDocument };
