export const SCREENER_UNIVERSE_STORAGE_KEY = 'screener.universe';
export const SCREENER_CURRENCY_FILTER_STORAGE_KEY = 'screener.currencyFilter';

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
