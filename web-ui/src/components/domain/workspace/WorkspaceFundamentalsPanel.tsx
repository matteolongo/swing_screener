import Button from '@/components/common/Button';
import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import {
  useFundamentalSnapshotQuery,
  useRefreshFundamentalSnapshotMutation,
} from '@/features/fundamentals/hooks';
import { t } from '@/i18n/t';

interface WorkspaceFundamentalsPanelProps {
  ticker: string;
}

export default function WorkspaceFundamentalsPanel({ ticker }: WorkspaceFundamentalsPanelProps) {
  const snapshotQuery = useFundamentalSnapshotQuery(ticker);
  const refreshMutation = useRefreshFundamentalSnapshotMutation();

  if (snapshotQuery.isLoading) {
    return <div className="text-sm text-gray-500">{t('workspaceFundamentals.loading')}</div>;
  }

  if (snapshotQuery.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">
          {snapshotQuery.error instanceof Error ? snapshotQuery.error.message : t('workspaceFundamentals.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => refreshMutation.mutate(ticker)}
          disabled={refreshMutation.isPending}
        >
          {t('workspaceFundamentals.retryRefresh')}
        </Button>
      </div>
    );
  }

  if (!snapshotQuery.data) {
    return <div className="text-sm text-gray-500">{t('workspaceFundamentals.empty')}</div>;
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
          {refreshMutation.isPending ? t('workspaceFundamentals.refreshing') : t('workspaceFundamentals.refreshSnapshot')}
        </Button>
      </div>
      <FundamentalsSnapshotCard snapshot={snapshotQuery.data} />
    </div>
  );
}
