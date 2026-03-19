import { useEffect, useMemo, useState } from 'react';

import Button from '@/components/common/Button';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import {
  useCompareFundamentalsMutation,
  useFundamentalsConfigQuery,
  useFundamentalsWarmupStatus,
  useStartFundamentalsWarmupMutation,
} from '@/features/fundamentals/hooks';

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
        <h1 className="text-2xl font-bold">Fundamentals</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Compare company-quality snapshots without changing the screener ranking.
        </p>
      </div>

      {configQuery.data ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Provider: {configQuery.data.providers.join(', ')} | cache TTL: {configQuery.data.cacheTtlHours}h | stale
          after: {configQuery.data.staleAfterDays}d
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium text-gray-700">Symbols</label>
        <input
          value={symbolsInput}
          onChange={(event) => setSymbolsInput(event.target.value)}
          placeholder="AAPL, MSFT, NVDA"
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" onClick={runCompare} disabled={symbols.length < 2 || compareMutation.isPending}>
            {compareMutation.isPending ? 'Comparing...' : 'Compare fundamentals'}
          </Button>
          <Button type="button" onClick={warmupSymbols} disabled={symbols.length < 1 || warmupMutation.isPending}>
            {warmupMutation.isPending ? 'Queueing...' : 'Warm listed symbols'}
          </Button>
          <Button type="button" onClick={warmupWatchlist} disabled={warmupMutation.isPending}>
            Warm watchlist
          </Button>
          <span className="text-xs text-gray-500">Compare needs 2+ tickers. Warmup works with one or more.</span>
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
              <div className="text-sm font-semibold text-sky-950">Fundamentals warmup</div>
              <div className="text-xs text-sky-800">
                Job {warmupJobId} · {warmupStatus?.source ?? 'queued'} · {warmupStatus?.status ?? 'queued'}
              </div>
            </div>
            <div className="text-right text-xs text-sky-800">
              <div>Progress: {progressText}</div>
              {warmupStatus?.lastCompletedSymbol ? <div>Last: {warmupStatus.lastCompletedSymbol}</div> : null}
            </div>
          </div>

          {warmupStatus ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div className="rounded-md bg-white/70 p-3 text-xs text-sky-900">
                <div className="text-sky-700">Coverage</div>
                <div className="mt-1">
                  supported {warmupStatus.coverageCounts.supported} · partial {warmupStatus.coverageCounts.partial} ·
                  insufficient {warmupStatus.coverageCounts.insufficient} · unsupported{' '}
                  {warmupStatus.coverageCounts.unsupported}
                </div>
              </div>
              <div className="rounded-md bg-white/70 p-3 text-xs text-sky-900">
                <div className="text-sky-700">Freshness</div>
                <div className="mt-1">
                  current {warmupStatus.freshnessCounts.current} · stale {warmupStatus.freshnessCounts.stale} ·
                  unknown {warmupStatus.freshnessCounts.unknown}
                </div>
              </div>
              <div className="rounded-md bg-white/70 p-3 text-xs text-sky-900">
                <div className="text-sky-700">Errors</div>
                <div className="mt-1">
                  {warmupStatus.errorCount}
                  {warmupStatus.errorSample ? ` · ${warmupStatus.errorSample}` : ''}
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
