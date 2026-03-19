import Button from '@/components/common/Button';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import {
  useFundamentalSnapshotQuery,
  useRefreshFundamentalSnapshotMutation,
} from '@/features/fundamentals/hooks';

interface WorkspaceFundamentalsPanelProps {
  ticker: string;
}

export default function WorkspaceFundamentalsPanel({ ticker }: WorkspaceFundamentalsPanelProps) {
  const snapshotQuery = useFundamentalSnapshotQuery(ticker);
  const refreshMutation = useRefreshFundamentalSnapshotMutation();

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

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
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
