import { RefreshCw, AlertTriangle, CheckCircle2, Target } from 'lucide-react';

import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Input from '@/components/common/Input';
import type { UniverseSummary } from '@/features/screener/types';
import type { UniverseDetail } from '@/features/universes/types';
import type {
  useRefreshUniverseMutation,
  useUpdateUniverseBenchmarkMutation,
} from '@/features/universes/hooks';
import { BENCHMARK_OPTIONS, freshnessLabel, freshnessVariant, sourceLabel } from './universesShared';

interface UniverseConfigTabProps {
  universes: UniverseSummary[];
  selectedSummary: UniverseSummary | null;
  detail: UniverseDetail | undefined;
  detailLoading: boolean;
  detailError: boolean;
  benchmarkDraft: string;
  onBenchmarkDraftChange: (value: string) => void;
  benchmarkMutation: ReturnType<typeof useUpdateUniverseBenchmarkMutation>;
  refreshMutation: ReturnType<typeof useRefreshUniverseMutation>;
}

export default function UniverseConfigTab({
  universes,
  selectedSummary,
  detail,
  detailLoading,
  detailError,
  benchmarkDraft,
  onBenchmarkDraftChange,
  benchmarkMutation,
  refreshMutation,
}: UniverseConfigTabProps) {
  const refreshResult = refreshMutation.data;

  return (
    <Card variant="bordered" className="p-4">
      {!selectedSummary ? (
        <div className="py-8 text-center text-sm text-muted">Select a universe to inspect it.</div>
      ) : detailLoading ? (
        <div className="text-sm text-muted">Loading universe detail…</div>
      ) : detailError || !detail ? (
        <div className="text-sm text-danger">Failed to load universe detail.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{detail.description}</h2>
              <p className="mt-1 text-sm text-muted">{detail.id}</p>
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
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="text-xs uppercase tracking-wide text-muted">Source</div>
              <div className="mt-1 text-sm font-medium text-foreground">{sourceLabel(detail.source)}</div>
              <div className="mt-1 text-xs text-muted">{detail.source_adapter}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="text-xs uppercase tracking-wide text-muted">Freshness</div>
              <div className="mt-1 text-sm font-medium text-foreground">Reviewed {detail.last_reviewed_at}</div>
              <div className="mt-1 text-xs text-muted">
                {detail.days_since_review == null ? 'Unknown age' : `${detail.days_since_review} days ago`}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="text-xs uppercase tracking-wide text-muted">Source As Of</div>
              <div className="mt-1 text-sm font-medium text-foreground">{detail.source_asof}</div>
              <div className="mt-1 text-xs text-muted">Configured benchmark {detail.benchmark}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="text-xs uppercase tracking-wide text-muted">Rules</div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {(detail.rules.currencies ?? []).join(', ') || 'No currency rule'}
              </div>
              <div className="mt-1 text-xs text-muted">
                {(detail.rules.exchange_mics ?? []).join(', ') || 'Any exchange'}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Target className="h-4 w-4 text-muted" />
                  Benchmark
                </div>
                <p className="mt-1 text-sm text-muted">
                  Select the index or ETF used for performance comparison in the screener and chart overlay.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:min-w-[360px] sm:flex-row">
                <div className="flex-1">
                  <label htmlFor="universe-benchmark" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                    Benchmark symbol
                  </label>
                  <Input
                    id="universe-benchmark"
                    type="text"
                    list="universe-benchmark-options"
                    value={benchmarkDraft}
                    onChange={(event) => onBenchmarkDraftChange(event.target.value.toUpperCase())}
                    placeholder="SPY"
                  />
                </div>
                <Button
                  onClick={() => benchmarkMutation.mutate({ benchmark: benchmarkDraft.trim().toUpperCase() })}
                  disabled={benchmarkMutation.isPending || benchmarkDraft.trim().length === 0}
                  variant="secondary"
                  size="sm"
                  className="self-end"
                >
                  {benchmarkMutation.isPending ? 'Saving…' : 'Save benchmark'}
                </Button>
              </div>
            </div>
            <datalist id="universe-benchmark-options">
              {Array.from(new Set([...BENCHMARK_OPTIONS, ...universes.map((item) => item.benchmark)]))
                .filter((value) => value && value.trim().length > 0)
                .map((value) => (
                  <option key={value} value={value} />
                ))}
            </datalist>
            {benchmarkMutation.isError ? (
              <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {benchmarkMutation.error instanceof Error ? benchmarkMutation.error.message : 'Failed to update benchmark.'}
              </div>
            ) : null}
            {benchmarkMutation.data ? (
              <div className="mt-3 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                Benchmark updated to {benchmarkMutation.data.benchmark}. The catalog and screener will pick it up after refresh.
              </div>
            ) : null}
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
              <div className="text-sm text-muted">This universe is manual-only for now.</div>
            )}
          </div>

          {refreshMutation.isError ? (
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {refreshMutation.error instanceof Error ? refreshMutation.error.message : 'Refresh failed.'}
            </div>
          ) : null}

          {refreshResult ? (
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {refreshResult.changed ? (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                )}
                Refresh Preview
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
                <span>{refreshResult.current_member_count} current</span>
                <span>{refreshResult.proposed_member_count} proposed</span>
                <span>{refreshResult.applied ? 'Applied locally' : 'Preview only'}</span>
              </div>
              {refreshResult.notes.length ? (
                <div className="mt-3 space-y-1 text-sm text-muted">
                  {refreshResult.notes.map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              ) : null}
              {(refreshResult.additions.length || refreshResult.removals.length) ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-success">Additions</div>
                    <div className="flex flex-wrap gap-2">
                      {refreshResult.additions.map((symbol) => (
                        <Badge key={symbol} variant="success">{symbol}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-danger">Removals</div>
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
            <div className="rounded-xl border border-danger/40 bg-danger/10 p-3">
              <div className="mb-2 text-sm font-semibold text-danger">Validation Issues</div>
              <div className="space-y-1 text-sm text-danger">
                {detail.validation_errors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            </div>
          ) : null}

          {detail.source_documents.length ? (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Source Documents</div>
              <div className="space-y-1">
                {detail.source_documents.map((document) => (
                  <a
                    key={`${document.label}-${document.url}`}
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-sm text-primary hover:text-primary hover:underline"
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
  );
}
