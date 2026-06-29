import { describe, it, expect, vi } from 'vitest';
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
    getByText('Clear').click();
    expect(onClear).toHaveBeenCalledWith('ticker_meta');
  });
});
