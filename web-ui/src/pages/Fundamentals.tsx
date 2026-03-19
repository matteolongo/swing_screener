import { useEffect, useMemo, useState } from 'react';

import Button from '@/components/common/Button';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import {
  useCompareFundamentalsMutation,
  useFundamentalsConfigQuery,
  useFundamentalsWarmupStatus,
  useStartFundamentalsWarmupMutation,
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
  const [warmupJobId, setWarmupJobId] = useState<string | undefined>(undefined);
  const [syncedWarmupJobId, setSyncedWarmupJobId] = useState<string | undefined>(undefined);
  const configQuery = useFundamentalsConfigQuery();
  const compareMutation = useCompareFundamentalsMutation();
  const warmupMutation = useStartFundamentalsWarmupMutation((launch) => {
    setWarmupJobId(launch.jobId);
    setSyncedWarmupJobId(undefined);
  });
  const warmupStatusQuery = useFundamentalsWarmupStatus(warmupJobId);
  const symbols = useMemo(() => normalizeSymbols(symbolsInput), [symbolsInput]);

  useEffect(() => {
    if (!warmupJobId || warmupStatusQuery.data?.status !== 'completed') {
      return;
    }
    if (syncedWarmupJobId === warmupJobId || symbols.length < 2) {
      return;
    }
    setSyncedWarmupJobId(warmupJobId);
    compareMutation.mutate({ symbols, forceRefresh: false });
  }, [compareMutation, symbols, syncedWarmupJobId, warmupJobId, warmupStatusQuery.data?.status]);

  const runCompare = () => {
    if (symbols.length < 2) return;
    compareMutation.mutate({ symbols, forceRefresh: false });
  };

  const warmupSymbols = () => {
    if (symbols.length < 1) return;
    warmupMutation.mutate({ source: 'symbols', symbols, forceRefresh: true });
  };

  const warmupWatchlist = () => {
    warmupMutation.mutate({ source: 'watchlist', forceRefresh: true });
  };

  const warmupStatus = warmupStatusQuery.data;
  const progressText =
    warmupStatus == null ? '0/0' : `${warmupStatus.completedSymbols}/${warmupStatus.totalSymbols}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('fundamentalsPage.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('fundamentalsPage.description')}
        </p>
      </div>

      {configQuery.data ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {t('fundamentalsPage.config.providerInfo', {
            provider: configQuery.data.providers.join(', '),
            ttl: configQuery.data.cacheTtlHours,
            stale: configQuery.data.staleAfterDays,
          })}
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label htmlFor="fundamentals-symbols-input" className="block text-sm font-medium text-gray-700">
          {t('fundamentalsPage.symbols.label')}
        </label>
        <input
          id="fundamentals-symbols-input"
          value={symbolsInput}
          onChange={(event) => setSymbolsInput(event.target.value)}
          placeholder={t('fundamentalsPage.symbols.placeholder')}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" onClick={runCompare} disabled={symbols.length < 2 || compareMutation.isPending}>
            {compareMutation.isPending ? t('fundamentalsPage.comparingAction') : t('fundamentalsPage.compareAction')}
          </Button>
          <Button type="button" onClick={warmupSymbols} disabled={symbols.length < 1 || warmupMutation.isPending}>
            {warmupMutation.isPending ? t('fundamentalsPage.queueingAction') : t('fundamentalsPage.warmupSymbolsAction')}
          </Button>
          <Button type="button" onClick={warmupWatchlist} disabled={warmupMutation.isPending}>
            {t('fundamentalsPage.warmupWatchlistAction')}
          </Button>
          <span className="text-xs text-gray-500">{t('fundamentalsPage.hint')}</span>
        </div>
        <div className="mt-3 space-y-1">
          {compareMutation.isError ? (
            <p className="text-sm text-rose-600">{compareMutation.error.message}</p>
          ) : null}
          {warmupMutation.isError ? (
            <p className="text-sm text-rose-600">{warmupMutation.error.message}</p>
          ) : null}
        </div>
      </div>

      {warmupJobId ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-sky-950">{t('fundamentalsPage.warmup.title')}</div>
              <div className="text-xs text-sky-800">
                {t('fundamentalsPage.warmup.job', {
                  jobId: warmupJobId,
                  source: warmupStatus?.source ?? 'queued',
                  status: warmupStatus?.status ?? 'queued',
                })}
              </div>
            </div>
            <div className="text-right text-xs text-sky-800">
              <div>{t('fundamentalsPage.warmup.progress', { progress: progressText })}</div>
              {warmupStatus?.lastCompletedSymbol ? (
                <div>{t('fundamentalsPage.warmup.last', { symbol: warmupStatus.lastCompletedSymbol })}</div>
              ) : null}
            </div>
          </div>

          {warmupStatus ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="rounded-md bg-white/70 p-3 text-xs text-sky-900">
                <div className="text-sky-700">{t('fundamentalsPage.warmup.coverage.label')}</div>
                <div className="mt-1">
                  {t('fundamentalsPage.warmup.coverage.stats', {
                    supported: warmupStatus.coverageCounts.supported,
                    partial: warmupStatus.coverageCounts.partial,
                    insufficient: warmupStatus.coverageCounts.insufficient,
                    unsupported: warmupStatus.coverageCounts.unsupported,
                  })}
                </div>
              </div>
              <div className="rounded-md bg-white/70 p-3 text-xs text-sky-900">
                <div className="text-sky-700">{t('fundamentalsPage.warmup.freshness.label')}</div>
                <div className="mt-1">
                  {t('fundamentalsPage.warmup.freshness.stats', {
                    current: warmupStatus.freshnessCounts.current,
                    stale: warmupStatus.freshnessCounts.stale,
                    unknown: warmupStatus.freshnessCounts.unknown,
                  })}
                </div>
              </div>
              <div className="rounded-md bg-white/70 p-3 text-xs text-sky-900">
                <div className="text-sky-700">{t('fundamentalsPage.warmup.errors.label')}</div>
                <div className="mt-1">
                  {warmupStatus.errorSample
                    ? t('fundamentalsPage.warmup.errors.statsWithSample', {
                        count: warmupStatus.errorCount,
                        sample: warmupStatus.errorSample,
                      })
                    : t('fundamentalsPage.warmup.errors.statsCount', { count: warmupStatus.errorCount })}
                </div>
              </div>
            </div>
          ) : null}

          {warmupStatusQuery.isError ? (
            <p className="mt-3 text-sm text-rose-600">{warmupStatusQuery.error.message}</p>
          ) : null}
        </div>
      ) : null}

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
