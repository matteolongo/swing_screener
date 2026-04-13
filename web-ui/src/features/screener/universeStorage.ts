export const SCREENER_UNIVERSE_STORAGE_KEY = 'screener.universe';
export const SCREENER_CURRENCY_FILTER_STORAGE_KEY = 'screener.currencyFilter';

// Maps removed universe ids to their replacements (null = dropped, no replacement → fall back to default).
const _REMOVED_UNIVERSE_IDS: Record<string, string | null> = {
  usd_all: 'broad_market_stocks',
  mega: 'broad_market_stocks',
  mega_all: 'broad_market_stocks',
  usd_mega_stocks: 'broad_market_stocks',
  mega_stocks: 'broad_market_stocks',
  usd_core_etfs: 'broad_market_etfs',
  core_etfs: 'broad_market_etfs',
  usd_defense_all: 'defense_stocks',
  defense_all: 'defense_stocks',
  mega_defense: 'defense_stocks',
  usd_defense_stocks: 'defense_stocks',
  defense_stocks: 'defense_stocks',
  usd_defense_etfs: 'defense_etfs',
  defense_etfs: 'defense_etfs',
  usd_healthcare_all: 'healthcare_stocks',
  healthcare_all: 'healthcare_stocks',
  mega_healthcare_biotech: 'healthcare_stocks',
  usd_healthcare_stocks: 'healthcare_stocks',
  healthcare_stocks: 'healthcare_stocks',
  usd_healthcare_etfs: 'healthcare_etfs',
  healthcare_etfs: 'healthcare_etfs',
  eur_europe_large: 'europe_large_caps',
  europe_large: 'europe_large_caps',
  mega_europe: 'europe_large_caps',
  usd_europe_large: 'global_proxy_stocks',
  eur_amsterdam_all: 'amsterdam_all',
  eur_amsterdam_aex: 'amsterdam_aex',
  eur_amsterdam_amx: 'amsterdam_amx',
  us_all: 'broad_market_stocks',
  us_mega_stocks: 'broad_market_stocks',
  us_core_etfs: 'broad_market_etfs',
  us_defense_all: 'defense_stocks',
  us_defense_stocks: 'defense_stocks',
  us_defense_etfs: 'defense_etfs',
  us_healthcare_all: 'healthcare_stocks',
  us_healthcare_stocks: 'healthcare_stocks',
  us_healthcare_etfs: 'healthcare_etfs',
  europe_large_eur: 'europe_large_caps',
  europe_proxies_usd: 'global_proxy_stocks',
  eur_all: null,
};

/**
 * One-time migration: rewrite removed universe ids in localStorage to their
 * replacements. Ids with no replacement are cleared (caller uses default).
 * Safe to call on every mount — skips write if the stored value is already valid.
 */
export function migrateRemovedUniverseIds(storage: Storage, defaultId = 'broad_market_stocks'): void {
  const raw = storage.getItem(SCREENER_UNIVERSE_STORAGE_KEY);
  const current = parseUniverseFromStorage(raw);
  if (!current) return;
  if (!(current in _REMOVED_UNIVERSE_IDS)) return;
  const replacement = _REMOVED_UNIVERSE_IDS[current] ?? defaultId;
  storage.setItem(SCREENER_UNIVERSE_STORAGE_KEY, JSON.stringify(replacement));
}

function normalizeDoubleQuotedLegacyString(rawValue: string): string {
  if (rawValue.startsWith('""') && rawValue.endsWith('""')) {
    return rawValue.slice(1, -1);
  }
  return rawValue;
}

function stripWrappedQuotes(rawValue: string): string {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1);
  }
  return rawValue;
}

export function parseUniverseValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return stripWrappedQuotes(normalizeDoubleQuotedLegacyString(value)) || null;
}

export function parseUniverseFromStorage(rawValue: string | null): string | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parseUniverseValue(parsed);
  } catch {
    return parseUniverseValue(rawValue);
  }
}
