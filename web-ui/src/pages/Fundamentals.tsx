import { useMemo, useState } from 'react';

import Button from '@/components/common/Button';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import {
  useCompareFundamentalsMutation,
  useFundamentalsConfigQuery,
} from '@/features/fundamentals/hooks';
import { t } from '@/i18n/t';

function normalizeSymbols(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

export default function FundamentalsPage() {
  const [symbolsInput, setSymbolsInput] = useState('AAPL, MSFT');
  const configQuery = useFundamentalsConfigQuery();
  const compareMutation = useCompareFundamentalsMutation();
  const symbols = useMemo(() => normalizeSymbols(symbolsInput), [symbolsInput]);

  const runCompare = () => {
    if (symbols.length < 2) return;
    compareMutation.mutate({ symbols, forceRefresh: false });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('fundamentalsPage.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('fundamentalsPage.subtitle')}
        </p>
      </div>

      {configQuery.data ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Provider: {configQuery.data.providers.join(', ')} | cache TTL: {configQuery.data.cacheTtlHours}h | stale
          after: {configQuery.data.staleAfterDays}d
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label htmlFor="fundamentals-symbols-input" className="block text-sm font-medium text-gray-700">
          {t('fundamentalsPage.symbolsLabel')}
        </label>
        <input
          id="fundamentals-symbols-input"
          value={symbolsInput}
          onChange={(event) => setSymbolsInput(event.target.value)}
          placeholder={t('fundamentalsPage.symbolsPlaceholder')}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" onClick={runCompare} disabled={symbols.length < 2 || compareMutation.isPending}>
            {compareMutation.isPending ? t('fundamentalsPage.comparingButton') : t('fundamentalsPage.compareButton')}
          </Button>
          <span className="text-xs text-gray-500">{t('fundamentalsPage.symbolsHint')}</span>
        </div>
        {compareMutation.isError ? (
          <p className="mt-3 text-sm text-rose-600">{compareMutation.error.message}</p>
        ) : null}
      </div>

      {compareMutation.data ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {compareMutation.data.snapshots.map((snapshot) => (
            <FundamentalsSnapshotCard key={snapshot.symbol} snapshot={snapshot} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
