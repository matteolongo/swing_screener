/**
 * Format number with specified decimals (e.g., 2.34, 1.5)
 */
export function formatNumber(value: number, decimals: number = 2): string {
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
export function formatPercent(value: number, decimals: number = 1): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format number as currency (e.g., $1,234.56)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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

/**
 * Get color class based on R-multiple value
 */
export function getRColor(r: number): string {
  if (r >= 1.0) return 'text-success';
  if (r >= -0.5) return 'text-warning';
  return 'text-danger';
}

/**
 * Get background color class based on R-multiple value
 */
export function getRBgColor(r: number): string {
  if (r >= 1.0) return 'bg-success/10';
  if (r >= -0.5) return 'bg-warning/10';
  return 'bg-danger/10';
}
