import type { MessageKey } from '@/i18n/types';

export interface TaxonomyOption {
  /** Backend-matching id (PoolSymbol.sector / index_memberships value). */
  id: string;
  /** i18n key for the display label (never render the id directly). */
  labelKey: MessageKey;
}

// Morningstar/yfinance sector vocabulary used to tag pool symbols. The `id` is
// matched verbatim against PoolSymbol.sector by the screener pre-filter; the
// display label is resolved through i18n.
export const SECTOR_OPTIONS: TaxonomyOption[] = [
  { id: 'Technology', labelKey: 'screener.taxonomy.sectorLabels.technology' },
  { id: 'Healthcare', labelKey: 'screener.taxonomy.sectorLabels.healthcare' },
  { id: 'Financial Services', labelKey: 'screener.taxonomy.sectorLabels.financialServices' },
  { id: 'Consumer Cyclical', labelKey: 'screener.taxonomy.sectorLabels.consumerCyclical' },
  { id: 'Consumer Defensive', labelKey: 'screener.taxonomy.sectorLabels.consumerDefensive' },
  { id: 'Energy', labelKey: 'screener.taxonomy.sectorLabels.energy' },
  { id: 'Industrials', labelKey: 'screener.taxonomy.sectorLabels.industrials' },
  { id: 'Basic Materials', labelKey: 'screener.taxonomy.sectorLabels.basicMaterials' },
  { id: 'Utilities', labelKey: 'screener.taxonomy.sectorLabels.utilities' },
  { id: 'Real Estate', labelKey: 'screener.taxonomy.sectorLabels.realEstate' },
  { id: 'Communication Services', labelKey: 'screener.taxonomy.sectorLabels.communicationServices' },
];

// Known index-membership ids (old universe ids) surfaced in the Index filter.
export const INDEX_OPTIONS: TaxonomyOption[] = [
  { id: 'us_sp500', labelKey: 'screener.taxonomy.indexLabels.us_sp500' },
  { id: 'us_nasdaq100', labelKey: 'screener.taxonomy.indexLabels.us_nasdaq100' },
  { id: 'us_dow30', labelKey: 'screener.taxonomy.indexLabels.us_dow30' },
  { id: 'germany_dax', labelKey: 'screener.taxonomy.indexLabels.germany_dax' },
  { id: 'france_cac40', labelKey: 'screener.taxonomy.indexLabels.france_cac40' },
  { id: 'uk_ftse100', labelKey: 'screener.taxonomy.indexLabels.uk_ftse100' },
  { id: 'spain_ibex35', labelKey: 'screener.taxonomy.indexLabels.spain_ibex35' },
  { id: 'europe_eurostoxx50', labelKey: 'screener.taxonomy.indexLabels.europe_eurostoxx50' },
  { id: 'amsterdam_aex', labelKey: 'screener.taxonomy.indexLabels.amsterdam_aex' },
  { id: 'italy_ftse_mib', labelKey: 'screener.taxonomy.indexLabels.italy_ftse_mib' },
  { id: 'broad_market_stocks', labelKey: 'screener.taxonomy.indexLabels.broad_market_stocks' },
];
