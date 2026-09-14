const SUPPORTED_CURRENCIES = new Set(['CHF', 'DKK', 'EUR', 'GBP', 'NOK', 'SEK', 'USD']);

export function isSupportedCurrency(value: unknown): value is string {
  return typeof value === 'string' && SUPPORTED_CURRENCIES.has(value.trim().toUpperCase());
}

export function normalizeReportingCurrency(value: unknown): string {
  return isSupportedCurrency(value) ? value.trim().toUpperCase() : 'UNKNOWN';
}
