import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
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
    expect(getByText('Clear')).toBeInTheDocument();
  });

  it('renders clearsOnRestart label when canClear is false', () => {
    const { getByText } = renderWithProviders(
      <CacheCard entry={memoryEntry} onClear={vi.fn()} clearing={false} />
    );
    expect(getByText('Clears on restart')).toBeInTheDocument();
  });

  it('disables clear button while clearing', () => {
    const { getByText } = renderWithProviders(
      <CacheCard entry={clearableEntry} onClear={vi.fn()} clearing={true} />
    );
    const btn = getByText('Clearing…') as HTMLButtonElement;
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
