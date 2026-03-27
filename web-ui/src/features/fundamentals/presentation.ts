import type { FundamentalMetricContext } from '@/features/fundamentals/types';

const PRICE_DERIVED_METRICS = new Set([
  'trailing_pe',
  'price_to_sales',
  'price_to_book',
  'book_to_price',
]);

export function formatFundamentalCadence(value?: string) {
  if (!value || value === 'unknown') return null;
  if (value === 'snapshot') return 'snapshot';
  if (value === 'quarterly') return 'latest quarter';
  if (value === 'annual') return 'latest FY';
  return value;
}

export function humanizeFundamentalSource(source?: string): string | null {
  if (!source) return null;
  return source.split('.')[0] ?? null;
}

export function isPriceDerivedFundamentalMetric(metricKey: string) {
  return PRICE_DERIVED_METRICS.has(metricKey);
}

export function metricHorizonLabel(metricKey: string, context?: FundamentalMetricContext) {
  if (isPriceDerivedFundamentalMetric(metricKey)) return 'price-derived';
  return formatFundamentalCadence(context?.cadence) ?? 'source-specific';
}

export function metricHorizonClass(metricKey: string, context?: FundamentalMetricContext) {
  const label = metricHorizonLabel(metricKey, context);
  if (label === 'price-derived') return 'bg-sky-100 text-sky-800';
  if (label === 'latest FY') return 'bg-emerald-100 text-emerald-800';
  if (label === 'latest quarter') return 'bg-amber-100 text-amber-800';
  if (label === 'snapshot') return 'bg-violet-100 text-violet-800';
  return 'bg-gray-100 text-gray-700';
}

export function formatFundamentalMetricMeta(metricKey: string, context?: FundamentalMetricContext) {
  if (!context && !isPriceDerivedFundamentalMetric(metricKey)) return null;

  const parts: string[] = [];
  if (isPriceDerivedFundamentalMetric(metricKey)) parts.push('price-derived');

  const cadence = formatFundamentalCadence(context?.cadence);
  if (cadence) parts.push(cadence);

  const provider = humanizeFundamentalSource(context?.source);
  if (provider) parts.push(provider);

  if (context?.derived) parts.push('derived');
  if (context?.periodEnd) parts.push(context.periodEnd);

  return parts.join(' · ') || null;
}
