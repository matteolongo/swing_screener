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

export type { UniverseSourceDocument };
