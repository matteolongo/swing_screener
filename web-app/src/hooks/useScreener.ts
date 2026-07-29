import { useCallback, useEffect, useState } from 'react';
import { useScreenerStore } from '@/store/useScreenerStore';
import { useAppStore } from '@/store/useAppStore';
import { runScreener, getPoolPresets } from '@/services/api/screenerApi';
import type { TaxonomyFilter, PoolPreset } from '@/types/api';

function universeToFilter(universe: string): Partial<TaxonomyFilter> {
  switch (universe) {
    case 'us_sp500':
      return { region: 'us', index_memberships: ['SP500'] };
    case 'us_nasdaq100':
      return { region: 'us', index_memberships: ['NASDAQ100'] };
    case 'us_dow30':
      return { region: 'us', index_memberships: ['DJI'] };
    case 'eu_midcap':
      return { region: 'eu', market_cap_tier: 'mid' };
    case 'nl_amsterdam':
      return { region: 'nl' };
    default:
      return {};
  }
}

export function useScreener() {
  const {
    candidates, universe, preset, sortBy, isLoading, error,
    setCandidates, setUniverse, setPreset, setSortBy, setLoading, setError,
  } = useScreenerStore();
  const { activeTab } = useAppStore();
  const [presets, setPresets] = useState<PoolPreset[]>([]);

  useEffect(() => {
    getPoolPresets().then((res) => setPresets(res.presets)).catch(() => {});
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: TaxonomyFilter = { ...universeToFilter(universe) };
      if (preset) {
        const selected = presets.find((p) => p.id === preset);
        if (selected) Object.assign(filter, selected.filter);
      }
      const result = await runScreener(filter);
      setCandidates(result.candidates);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run screener');
    } finally {
      setLoading(false);
    }
  }, [universe, preset, presets, setCandidates, setLoading, setError]);

  useEffect(() => {
    if (activeTab === 'screener' && candidates.length === 0) {
      refetch();
    }
  }, [activeTab]);

  return {
    candidates, isLoading, error, refetch,
    universe, setUniverse,
    preset, setPreset,
    sortBy, setSortBy,
    presets,
  };
}
