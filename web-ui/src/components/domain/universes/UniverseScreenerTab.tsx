import Card from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import type { useRunScreenerMutation } from '@/features/screener/hooks';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { actionLabel } from './universesShared';

interface UniverseScreenerTabProps {
  discoveryScreenerMutation: ReturnType<typeof useRunScreenerMutation>;
  onSelectTicker: (ticker: string) => void;
}

export default function UniverseScreenerTab({
  discoveryScreenerMutation,
  onSelectTicker,
}: UniverseScreenerTabProps) {
  const discoveryScreenerResult = discoveryScreenerMutation.data;

  return (
    <Card variant="bordered" className="p-4">
      {discoveryScreenerMutation.isError ? (
        <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {discoveryScreenerMutation.error instanceof Error ? discoveryScreenerMutation.error.message : 'Screener run failed.'}
        </div>
      ) : null}
      {discoveryScreenerResult ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Screener Results for Discovered Symbols</h3>
            <Badge variant="default">{discoveryScreenerResult.candidates.length} candidates</Badge>
            <Badge variant="default">{discoveryScreenerResult.totalScreened} screened</Badge>
            {discoveryScreenerResult.benchmarkTicker ? (
              <Badge variant="default">Benchmark {discoveryScreenerResult.benchmarkTicker}</Badge>
            ) : null}
          </div>
          {discoveryScreenerResult.warnings?.length ? (
            <div className="space-y-1 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              {discoveryScreenerResult.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
          <div className="max-h-[520px] overflow-auto rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Signal</th>
                  <th className="px-3 py-2 text-right">Close</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-right">6M momentum</th>
                  <th className="px-3 py-2 text-right">Rel strength</th>
                  <th className="px-3 py-2 text-right">R:R</th>
                  <th className="px-3 py-2">Fundamentals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {discoveryScreenerResult.candidates.map((candidate) => (
                  <tr
                    key={candidate.ticker}
                    onClick={() => onSelectTicker(candidate.ticker)}
                    className="cursor-pointer hover:bg-foreground/5"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">#{candidate.priorityRank ?? candidate.rank}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground">{candidate.ticker}</div>
                      <div className="text-xs text-muted">
                        {candidate.name ?? '—'}
                        {candidate.sector ? ` · ${candidate.sector}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted">{actionLabel(candidate)}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{formatCurrency(candidate.close, candidate.currency)}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{candidate.score.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{formatPercent(candidate.momentum6m, 1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{formatPercent(candidate.relStrength, 1)}</td>
                    <td className="px-3 py-2 text-right font-mono text-foreground">{candidate.rr != null ? candidate.rr.toFixed(1) : '—'}</td>
                    <td className="px-3 py-2 text-muted">{candidate.fundamentalsCoverageStatus ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted">
          Run discovery on the Discovery tab, then click "Run Screener on These Symbols".
        </div>
      )}
    </Card>
  );
}
