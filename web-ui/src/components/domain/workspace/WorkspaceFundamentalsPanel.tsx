import Button from '@/components/common/Button';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import {
  useDegiroCapabilityAuditMutation,
  useFundamentalSnapshotQuery,
  useRefreshFundamentalSnapshotMutation,
} from '@/features/fundamentals/hooks';
import type { DegiroAuditRecord } from '@/features/fundamentals/types';

interface WorkspaceFundamentalsPanelProps {
  ticker: string;
}

const CAPABILITY_COLS = ['quote', 'profile', 'ratios', 'estimates', 'statements', 'news'] as const;
type CapCol = typeof CAPABILITY_COLS[number];
const CAP_KEY: Record<CapCol, keyof DegiroAuditRecord> = {
  quote: 'hasQuote', profile: 'hasProfile', ratios: 'hasRatios',
  estimates: 'hasEstimates', statements: 'hasStatements', news: 'hasNews',
};

export default function WorkspaceFundamentalsPanel({ ticker }: WorkspaceFundamentalsPanelProps) {
  const snapshotQuery = useFundamentalSnapshotQuery(ticker);
  const refreshMutation = useRefreshFundamentalSnapshotMutation();
  const degiroAuditMutation = useDegiroCapabilityAuditMutation();

  if (snapshotQuery.isLoading) {
    return <div className="text-sm text-gray-500">Loading fundamentals...</div>;
  }

  if (snapshotQuery.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">
          {snapshotQuery.error instanceof Error ? snapshotQuery.error.message : 'Failed to load fundamentals'}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => refreshMutation.mutate(ticker)}
          disabled={refreshMutation.isPending}
        >
          Retry refresh
        </Button>
      </div>
    );
  }

  if (!snapshotQuery.data) {
    return <div className="text-sm text-gray-500">No fundamentals snapshot available.</div>;
  }

  const degiroRecord = degiroAuditMutation.data?.results[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => degiroAuditMutation.mutate([ticker])}
            disabled={degiroAuditMutation.isPending}
            title="Check which DeGiro data endpoints are available for this symbol"
          >
            {degiroAuditMutation.isPending ? 'Checking...' : 'DeGiro'}
          </Button>
          {degiroRecord ? (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              {CAPABILITY_COLS.map((col) => (
                <span key={col} title={col} className="flex items-center gap-0.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${degiroRecord[CAP_KEY[col]] ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  />
                  <span className="text-[10px]">{col}</span>
                </span>
              ))}
              {degiroRecord.resolutionConfidence === 'not_found' || degiroRecord.resolutionConfidence === 'ambiguous' ? (
                <span className="ml-1 text-amber-600">({degiroRecord.resolutionConfidence})</span>
              ) : null}
            </span>
          ) : degiroAuditMutation.isError ? (
            <span className="text-xs text-rose-500" title={degiroAuditMutation.error.message}>
              unavailable
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => refreshMutation.mutate(ticker)}
          disabled={refreshMutation.isPending}
        >
          {refreshMutation.isPending ? 'Refreshing...' : 'Refresh snapshot'}
        </Button>
      </div>
      <FundamentalsSnapshotCard snapshot={snapshotQuery.data} />
    </div>
  );
}
