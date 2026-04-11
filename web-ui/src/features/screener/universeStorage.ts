export const SCREENER_UNIVERSE_STORAGE_KEY = 'screener.universe';
export const SCREENER_CURRENCY_FILTER_STORAGE_KEY = 'screener.currencyFilter';

// Maps removed universe ids to their replacements (null = dropped, no replacement → fall back to default).
const _REMOVED_UNIVERSE_IDS: Record<string, string | null> = {
  usd_all: 'us_all',
  mega: 'us_all',
  mega_all: 'us_all',
  usd_mega_stocks: 'us_mega_stocks',
  mega_stocks: 'us_mega_stocks',
  usd_core_etfs: 'us_core_etfs',
  core_etfs: 'us_core_etfs',
  usd_defense_all: 'us_defense_all',
  defense_all: 'us_defense_all',
  mega_defense: 'us_defense_all',
  usd_defense_stocks: 'us_defense_stocks',
  defense_stocks: 'us_defense_stocks',
  usd_defense_etfs: 'us_defense_etfs',
  defense_etfs: 'us_defense_etfs',
  usd_healthcare_all: 'us_healthcare_all',
  healthcare_all: 'us_healthcare_all',
  mega_healthcare_biotech: 'us_healthcare_all',
  usd_healthcare_stocks: 'us_healthcare_stocks',
  healthcare_stocks: 'us_healthcare_stocks',
  usd_healthcare_etfs: 'us_healthcare_etfs',
  healthcare_etfs: 'us_healthcare_etfs',
  eur_europe_large: 'europe_large_eur',
  europe_large: 'europe_large_eur',
  mega_europe: 'europe_large_eur',
  usd_europe_large: 'europe_proxies_usd',
  eur_amsterdam_all: 'amsterdam_all',
  eur_amsterdam_aex: 'amsterdam_aex',
  eur_amsterdam_amx: 'amsterdam_amx',
  eur_all: null,
};

/**
 * One-time migration: rewrite removed universe ids in localStorage to their
 * replacements. Ids with no replacement are cleared (caller uses default).
 * Safe to call on every mount — skips write if the stored value is already valid.
 */
export function migrateRemovedUniverseIds(storage: Storage, defaultId = 'us_all'): void {
  const raw = storage.getItem(SCREENER_UNIVERSE_STORAGE_KEY);
  const current = parseUniverseFromStorage(raw);
  if (!current) return;
  if (!(current in _REMOVED_UNIVERSE_IDS)) return;
  const replacement = _REMOVED_UNIVERSE_IDS[current] ?? defaultId;
  storage.setItem(SCREENER_UNIVERSE_STORAGE_KEY, JSON.stringify(replacement));
}

function looksLikeJsonLiteral(value: string): boolean {
  const trimmed = value.trim();
  return (
    value.startsWith('"') ||
    value.startsWith('{') ||
    value.startsWith('[') ||
    value === 'true' ||
    value === 'false' ||
    value === 'null' ||
    (trimmed !== '' && !Number.isNaN(Number(trimmed)))
  );
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
