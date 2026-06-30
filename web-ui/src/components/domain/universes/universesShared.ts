import type { ScreenerCandidate, UniverseSummary } from '@/features/screener/types';

export const BENCHMARK_OPTIONS = [
  'ACWI',
  'SPY',
  'QQQ',
  'IWM',
  'VXUS',
  'VGK',
  'IXC',
  'IXG',
  'IXJ',
  'SMH',
  'SOXX',
  'ITA',
  'XLI',
  'XLP',
  'XLY',
  '^AEX',
  '^AMX',
  '^STOXX50E',
  '^GDAXI',
  '^FCHI',
  '^IBEX',
  '^FTSE',
  '^GSPC',
] as const;

export const DISCOVERY_SCREENS = [
  { value: 'most_actives', label: 'Most active' },
  { value: 'day_gainers', label: 'Day gainers' },
  { value: 'day_losers', label: 'Day losers' },
] as const;

export const MARKET_PRESETS = [
  { value: 'us_major', label: 'US major exchanges', currencies: ['USD'], exchangeMics: ['XNAS', 'XNYS'], eodhdExchanges: ['NASDAQ', 'NYSE'] },
  { value: 'amsterdam', label: 'Amsterdam', currencies: ['EUR'], exchangeMics: ['XAMS'], eodhdExchanges: ['AS'] },
  { value: 'euronext_core', label: 'Euronext core', currencies: ['EUR'], exchangeMics: ['XAMS', 'XPAR', 'XBRU'], eodhdExchanges: ['AS', 'PA', 'BR'] },
  { value: 'global_keyed', label: 'Global keyed sample', currencies: [], exchangeMics: [], eodhdExchanges: ['NASDAQ', 'NYSE', 'AS', 'PA', 'LSE', 'HK'] },
  { value: 'custom_any', label: 'Any market', currencies: [], exchangeMics: [], eodhdExchanges: [] },
] as const;

export const CURRENCY_PRESETS = [
  { value: 'preset', label: 'Market preset' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD,EUR', label: 'USD + EUR' },
  { value: 'any', label: 'Any currency' },
] as const;

export const TYPE_PRESETS = [
  { value: 'EQUITY', label: 'Equities' },
  { value: 'ETF', label: 'ETFs' },
  { value: 'EQUITY,ETF', label: 'Equities + ETFs' },
] as const;

export const VOLUME_PRESETS = [
  { value: 0, label: 'Any volume' },
  { value: 500_000, label: '500K+' },
  { value: 1_000_000, label: '1M+' },
  { value: 5_000_000, label: '5M+' },
] as const;

export const MARKET_CAP_PRESETS = [
  { value: 0, label: 'Any market cap' },
  { value: 1_000_000_000, label: '$1B+' },
  { value: 10_000_000_000, label: '$10B+' },
  { value: 50_000_000_000, label: '$50B+' },
] as const;

export const YAHOO_SUPPORTED_MICS = new Set(['ARCX', 'BATS', 'XASE', 'XNAS', 'XNYS', 'XOTC']);

export const freshnessVariant = (status: UniverseSummary['freshness_status']): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'fresh':
      return 'success';
    case 'review_due':
      return 'warning';
    case 'stale':
      return 'error';
    default:
      return 'default';
  }
};

export const freshnessLabel = (status: UniverseSummary['freshness_status']): string => {
  switch (status) {
    case 'fresh':
      return 'Fresh';
    case 'review_due':
      return 'Review due';
    case 'stale':
      return 'Stale';
    default:
      return 'Unknown';
  }
};

export const sourceLabel = (source: string): string => {
  if (source === 'euronext_review') return 'Euronext review';
  if (source === 'manual') return 'Manual';
  return source;
};

export const taxonomyRows = (taxonomy: Record<string, Record<string, number>>, key: string): Array<[string, number]> => (
  Object.entries(taxonomy[key] ?? {}).sort((a, b) => b[1] - a[1])
);

export const actionLabel = (candidate: ScreenerCandidate): string => {
  const action = candidate.decisionSummary?.action;
  if (action === 'BUY_NOW') return 'Buy Now';
  if (action === 'BUY_ON_PULLBACK') return 'Pullback';
  if (action === 'WAIT_FOR_BREAKOUT') return 'Breakout';
  if (action === 'WATCH') return 'Watch';
  if (action === 'TACTICAL_ONLY') return 'Tactical';
  if (action === 'AVOID') return 'Avoid';
  if (action === 'MANAGE_ONLY') return 'Manage';
  return candidate.signal ?? '—';
};

export type DetailTab = 'config' | 'constituents' | 'discovery' | 'screener' | 'pool';

export const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'config', label: 'Config' },
  { id: 'constituents', label: 'Constituents' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'screener', label: 'Screener' },
  { id: 'pool', label: 'Pool' },
];
