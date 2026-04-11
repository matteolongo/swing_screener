import { useEffect, useMemo, useState } from 'react';

import Button from '@/components/common/Button';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import {
  useCompareFundamentalsMutation,
  useDegiroPortfolioAuditMutation,
  useFundamentalsConfigQuery,
  useFundamentalsWarmupStatus,
  useStartFundamentalsWarmupMutation,
} from '@/features/fundamentals/hooks';
import { useDegiroStatusQuery } from '@/features/portfolio/hooks';
import type { DegiroAuditRecord } from '@/features/fundamentals/types';
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

function CapabilityDot({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      title={value ? 'Available' : 'Unavailable'}
    />
  );
}

function DegiroAuditTable({ records }: { records: DegiroAuditRecord[] }) {
  const cols = ['quote', 'profile', 'ratios', 'estimates', 'statements', 'news', 'agenda'] as const;
  const colKey: Record<typeof cols[number], keyof DegiroAuditRecord> = {
    quote: 'hasQuote',
    profile: 'hasProfile',
    ratios: 'hasRatios',
    estimates: 'hasEstimates',
    statements: 'hasStatements',
    news: 'hasNews',
    agenda: 'hasAgenda',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">ISIN</th>
            {cols.map((c) => (
              <th key={c} className="px-2 py-2 text-center">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {records.map((r) => (
            <tr key={r.productId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-2 pr-4 font-medium">{r.name}</td>
              <td className="py-2 pr-4 font-mono text-xs text-gray-500">{r.isin ?? '—'}</td>
              {cols.map((c) => (
                <td key={c} className="px-2 py-2 text-center">
                  <CapabilityDot value={r[colKey[c]] as boolean} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface FundamentalsPageProps {
  initialSymbol?: string;
}

export default function FundamentalsPage({ initialSymbol }: FundamentalsPageProps) {
  const [symbolsInput, setSymbolsInput] = useState('AAPL, MSFT');
  const [warmupJobId, setWarmupJobId] = useState<string | undefined>(undefined);
  const [syncedWarmupJobId, setSyncedWarmupJobId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (initialSymbol) setSymbolsInput(initialSymbol);
  }, [initialSymbol]);

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

  const degiroAuditMutation = useDegiroPortfolioAuditMutation();
  const degiroStatusQuery = useDegiroStatusQuery();
  const degiroStatus = degiroStatusQuery.data;
  const showDegiroUnavailable = degiroStatusQuery.isSuccess && degiroStatus?.available === false;

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

      {/* DeGiro Portfolio Audit */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">DeGiro Portfolio Audit</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Probe available data endpoints for each product in your live DeGiro portfolio.
            </p>
          </div>
          {degiroStatus?.available ? (
            <Button
              type="button"
              onClick={() => degiroAuditMutation.mutate()}
              disabled={degiroAuditMutation.isPending}
            >
              {degiroAuditMutation.isPending ? 'Running…' : 'Run Audit'}
            </Button>
          ) : null}
        </div>

        {showDegiroUnavailable ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">DeGiro audit is unavailable on this setup</p>
            <p className="mt-1">
              This does not affect screener runs, Daily Review, workspace analysis, or fundamentals
              snapshots. It only removes DeGiro-specific audit and sync actions.
            </p>
            <p className="mt-2 text-xs">{degiroStatus?.detail}</p>
          </div>
        ) : null}

        {degiroStatusQuery.isError ? (
          <p className="mt-3 text-sm text-amber-600">
            Could not verify DeGiro availability. The core fundamentals workflow remains available.
          </p>
        ) : null}

        {degiroAuditMutation.isError ? (
          <p className="mt-3 text-sm text-rose-600">{degiroAuditMutation.error.message}</p>
        ) : null}

        {degiroAuditMutation.data ? (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {degiroAuditMutation.data.summaryCounts.total ?? 0}
                </span>{' '}
                products
              </span>
              {(['has_quote', 'has_profile', 'has_ratios', 'has_estimates'] as const).map((k) => (
                <span key={k}>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {degiroAuditMutation.data!.summaryCounts[k] ?? 0}
                  </span>{' '}
                  {k.replace('has_', '')}
                </span>
              ))}
              <span className="text-gray-400">
                {new Date(degiroAuditMutation.data.createdAt).toLocaleString()}
              </span>
            </div>
            <DegiroAuditTable records={degiroAuditMutation.data.results} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
