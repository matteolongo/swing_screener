export const SCREENER_UNIVERSE_STORAGE_KEY = 'screener.universe';
export const SCREENER_CURRENCY_FILTER_STORAGE_KEY = 'screener.currencyFilter';

const UNIVERSE_ALIASES: Record<string, string> = {
  mega: 'usd_all',
  mega_all: 'usd_all',
  mega_stocks: 'usd_mega_stocks',
  core_etfs: 'usd_core_etfs',
  defense_all: 'usd_defense_all',
  defense_stocks: 'usd_defense_stocks',
  defense_etfs: 'usd_defense_etfs',
  healthcare_all: 'usd_healthcare_all',
  healthcare_stocks: 'usd_healthcare_stocks',
  healthcare_etfs: 'usd_healthcare_etfs',
  mega_defense: 'usd_defense_all',
  mega_healthcare_biotech: 'usd_healthcare_all',
  mega_europe: 'eur_europe_large',
  europe_large: 'eur_europe_large',
  amsterdam_all: 'eur_amsterdam_all',
  amsterdam_aex: 'eur_amsterdam_aex',
  amsterdam_amx: 'eur_amsterdam_amx',
};

function looksLikeJsonLiteral(value: string): boolean {
  return (
    value.startsWith('"') ||
    value.startsWith('{') ||
    value.startsWith('[') ||
    value === 'true' ||
    value === 'false' ||
    value === 'null' ||
    (value !== '' && !Number.isNaN(Number(value)))
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

export function normalizeUniverse(value: string | null | undefined): string | null {
  if (!value) return null;
  return UNIVERSE_ALIASES[value] ?? value;
}

export function parseUniverseValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return normalizeUniverse(stripWrappedQuotes(normalizeDoubleQuotedLegacyString(value)));
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

export function migrateLegacyScreenerStorage(storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  const keys = [SCREENER_UNIVERSE_STORAGE_KEY, SCREENER_CURRENCY_FILTER_STORAGE_KEY];

  keys.forEach((key) => {
    const rawValue = storage.getItem(key);
    if (!rawValue) {
      return;
    }

    const normalizedValue = normalizeDoubleQuotedLegacyString(rawValue);
    if (normalizedValue !== rawValue) {
      storage.setItem(key, normalizedValue);
      return;
    }

    const trimmed = rawValue.trim();
    if (!looksLikeJsonLiteral(trimmed)) {
      storage.setItem(key, JSON.stringify(rawValue));
    }
  });
}
