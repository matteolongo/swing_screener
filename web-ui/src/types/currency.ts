export const SUPPORTED_CURRENCY_CODES = ['CHF', 'DKK', 'EUR', 'GBP', 'NOK', 'SEK', 'USD'] as const;
const SUPPORTED_CURRENCIES = new Set<string>(SUPPORTED_CURRENCY_CODES);

export function isSupportedCurrency(value: unknown): value is string {
  return typeof value === 'string' && SUPPORTED_CURRENCIES.has(value.trim().toUpperCase());
}

export function normalizeReportingCurrency(value: unknown): string {
  return isSupportedCurrency(value) ? value.trim().toUpperCase() : 'UNKNOWN';
}
