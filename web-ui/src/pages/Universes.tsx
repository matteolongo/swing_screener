import { RefreshCw, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { useRefreshUniverseMutation, useUniverseCatalog, useUniverseDetail } from '@/features/universes/hooks';
import type { UniverseSummary } from '@/features/screener/types';

const freshnessVariant = (status: UniverseSummary['freshness_status']): 'success' | 'warning' | 'error' | 'default' => {
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

const freshnessLabel = (status: UniverseSummary['freshness_status']): string => {
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

const sourceLabel = (source: string): string => {
  if (source === 'euronext_review') return 'Euronext review';
  if (source === 'manual') return 'Manual';
  return source;
};

export default function Universes() {
  const catalogQuery = useUniverseCatalog();
  const universes = catalogQuery.data?.universes ?? [];
  const [selectedUniverseId, setSelectedUniverseId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedUniverseId && universes.length > 0) {
      setSelectedUniverseId(universes[0].id);
    }
  }, [selectedUniverseId, universes]);

  const detailQuery = useUniverseDetail(selectedUniverseId);
  const refreshMutation = useRefreshUniverseMutation(selectedUniverseId);
  const selectedSummary = useMemo(
    () => universes.find((item) => item.id === selectedUniverseId) ?? null,
    [selectedUniverseId, universes],
  );
  const detail = detailQuery.data;
  const refreshResult = refreshMutation.data;

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Universe Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review source coverage, freshness, validation, and refresh official universes without editing snapshots by hand.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card variant="bordered" className="p-3">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Configured Universes</h2>
          </div>
          {catalogQuery.isLoading ? (
            <div className="text-sm text-gray-500">Loading universe catalog…</div>
          ) : catalogQuery.isError ? (
            <div className="text-sm text-red-600">Failed to load universe catalog.</div>
          ) : (
            <div className="space-y-2">
              {universes.map((universe) => {
                const selected = universe.id === selectedUniverseId;
                return (
                  <button
                    key={universe.id}
                    type="button"
                    onClick={() => setSelectedUniverseId(universe.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{universe.description}</div>
                        <div className="mt-1 text-xs text-gray-500">{universe.id}</div>
                      </div>
                      <Badge variant={freshnessVariant(universe.freshness_status)}>
                        {freshnessLabel(universe.freshness_status)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span>{universe.member_count} members</span>
                      <span>{sourceLabel(universe.source)}</span>
                      <span>as of {universe.source_asof}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card variant="bordered" className="p-4">
            {!selectedSummary ? (
              <div className="text-sm text-gray-500">Select a universe to inspect it.</div>
            ) : detailQuery.isLoading ? (
              <div className="text-sm text-gray-500">Loading universe detail…</div>
            ) : detailQuery.isError || !detail ? (
              <div className="text-sm text-red-600">Failed to load universe detail.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{detail.description}</h2>
                    <p className="mt-1 text-sm text-gray-500">{detail.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={freshnessVariant(detail.freshness_status)}>
                      {freshnessLabel(detail.freshness_status)}
                    </Badge>
                    <Badge variant="default">{detail.kind}</Badge>
                    <Badge variant="default">{detail.member_count} members</Badge>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Source</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">{sourceLabel(detail.source)}</div>
                    <div className="mt-1 text-xs text-gray-500">{detail.source_adapter}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Freshness</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">Reviewed {detail.last_reviewed_at}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {detail.days_since_review == null ? 'Unknown age' : `${detail.days_since_review} days ago`}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Source As Of</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">{detail.source_asof}</div>
                    <div className="mt-1 text-xs text-gray-500">Benchmark {detail.benchmark}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Rules</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">
                      {(detail.rules.currencies ?? []).join(', ') || 'No currency rule'}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {(detail.rules.exchange_mics ?? []).join(', ') || 'Any exchange'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {detail.refreshable ? (
                    <>
                      <Button
                        onClick={() => refreshMutation.mutate({ apply: false })}
                        disabled={refreshMutation.isPending}
                        size="sm"
                      >
                        {refreshMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Refreshing…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Preview Refresh
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => refreshMutation.mutate({ apply: true })}
                        disabled={refreshMutation.isPending}
                        variant="secondary"
                        size="sm"
                      >
                        Apply Refresh
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">This universe is manual-only for now.</div>
                  )}
                </div>

                {refreshMutation.isError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {refreshMutation.error instanceof Error ? refreshMutation.error.message : 'Refresh failed.'}
                  </div>
                ) : null}

                {refreshResult ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      {refreshResult.changed ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      Refresh Preview
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                      <span>{refreshResult.current_member_count} current</span>
                      <span>{refreshResult.proposed_member_count} proposed</span>
                      <span>{refreshResult.applied ? 'Applied locally' : 'Preview only'}</span>
                    </div>
                    {refreshResult.notes.length ? (
                      <div className="mt-3 space-y-1 text-sm text-gray-600">
                        {refreshResult.notes.map((note) => (
                          <div key={note}>{note}</div>
                        ))}
                      </div>
                    ) : null}
                    {(refreshResult.additions.length || refreshResult.removals.length) ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Additions</div>
                          <div className="flex flex-wrap gap-2">
                            {refreshResult.additions.map((symbol) => (
                              <Badge key={symbol} variant="success">{symbol}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">Removals</div>
                          <div className="flex flex-wrap gap-2">
                            {refreshResult.removals.map((symbol) => (
                              <Badge key={symbol} variant="error">{symbol}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {detail.validation_errors.length ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="mb-2 text-sm font-semibold text-red-700">Validation Issues</div>
                    <div className="space-y-1 text-sm text-red-700">
                      {detail.validation_errors.map((error) => (
                        <div key={error}>{error}</div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {detail.source_documents.length ? (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Source Documents</div>
                    <div className="space-y-1">
                      {detail.source_documents.map((document) => (
                        <a
                          key={`${document.label}-${document.url}`}
                          href={document.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-sm text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {document.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          {detail ? (
            <Card variant="bordered" className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Constituents</h3>
                <div className="text-xs text-gray-500">{detail.constituents.length} rows</div>
              </div>
              <div className="max-h-[520px] overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Source Name</th>
                      <th className="px-3 py-2">Exchange</th>
                      <th className="px-3 py-2">Currency</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {detail.constituents.map((constituent) => (
                      <tr key={constituent.symbol}>
                        <td className="px-3 py-2 font-medium text-gray-900">{constituent.symbol}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.source_name ?? constituent.source_symbol ?? constituent.symbol}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.exchange_mic ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.currency ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.instrument_type ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
