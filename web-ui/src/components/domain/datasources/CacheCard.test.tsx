import { afterEach, describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import CacheCard from './CacheCard';
import type { CacheStatusEntry } from '@/features/datasources/cacheApi';

const clearableEntry: CacheStatusEntry = {
  id: 'ticker_meta',
  label: 'Ticker Metadata',
  storage: 'disk_json',
  ttlDescription: '30 days',
  canClear: true,
  lastModifiedAt: null,
  entryCount: 42,
};

const memoryEntry: CacheStatusEntry = {
  id: 'currency_lru',
  label: 'Currency Detect (LRU)',
  storage: 'memory',
  ttlDescription: 'Process lifetime',
  canClear: false,
  lastModifiedAt: null,
  entryCount: null,
};

describe('CacheCard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders clear button when canClear is true', () => {
    const { getByText } = renderWithProviders(
      <CacheCard entry={clearableEntry} onClear={vi.fn()} clearing={false} />
    );
    expect(getByText(t('datasources.cache.clear'))).toBeInTheDocument();
  });

  it('renders clearsOnRestart label when canClear is false', () => {
    const { getByText } = renderWithProviders(
      <CacheCard entry={memoryEntry} onClear={vi.fn()} clearing={false} />
    );
    expect(getByText(t('datasources.cache.clearsOnRestart'))).toBeInTheDocument();
  });

  it('disables clear button while clearing', () => {
    const { getByText } = renderWithProviders(
      <CacheCard entry={clearableEntry} onClear={vi.fn()} clearing={true} />
    );
    const btn = getByText(t('datasources.cache.clearing')) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('calls onClear with entry id when clicked', () => {
    const onClear = vi.fn();
    const { getByText } = renderWithProviders(
      <CacheCard entry={clearableEntry} onClear={onClear} clearing={false} />
    );
    getByText(t('datasources.cache.clear')).click();
    expect(onClear).toHaveBeenCalledWith('ticker_meta');
  });

  it('renders relative time from i18n keys when lastModifiedAt is set', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T12:00:00Z'));

    const entry: CacheStatusEntry = {
      ...clearableEntry,
      lastModifiedAt: '2026-06-29T11:58:00Z', // 2 minutes ago
    };

    const { getByText } = renderWithProviders(
      <CacheCard entry={entry} onClear={vi.fn()} clearing={false} />
    );

    expect(getByText(new RegExp(t('common.relativeTime.minutesAgo', { value: 2 })))).toBeInTheDocument();
  });
});
