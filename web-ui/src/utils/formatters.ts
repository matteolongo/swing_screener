/**
 * Format number with specified decimals (e.g., 2.34, 1.5)
 */
export function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value == null) return '—';
  return value.toFixed(decimals);
}

/**
 * Format number as R-multiple (e.g., +2.34R, -0.5R)
 */
export function formatR(r: number): string {
  const sign = r >= 0 ? '+' : '';
  return `${sign}${r.toFixed(2)}R`;
}

/**
 * Format number as percentage (e.g., 42.3%, -5.1%)
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format decimal ratio as percentage (e.g., 0.0082 -> 0.8%)
 */
export function formatRatioAsPercent(value: number, decimals: number = 1): string {
  return formatPercent(value * 100, decimals);
}

/**
 * Format screener score on a consistent human-readable 0..100 scale.
 * Backend ranking emits 0..1 percentile scores, but some test/mocked paths still provide 0..100.
 */
export function formatScreenerScore(value: number, decimals: number = 1): string {
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return normalized.toFixed(decimals);
}

/**
 * Format confidence on a consistent 0..100 percentage scale.
 */
export function formatConfidencePercent(value: number, decimals: number = 1): string {
  const normalized = Math.abs(value) <= 1 ? value * 100 : value;
  return normalized.toFixed(decimals);
}

/**
 * Format number as currency (e.g., $1,234.56 / €1,234.56)
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Format number as price (e.g., $123.45)
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Format date (e.g., "Feb 5, 2026")
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Format datetime (e.g., "Feb 5, 2026 14:30")
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
