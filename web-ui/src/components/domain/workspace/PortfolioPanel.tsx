import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import PortfolioTable from '@/components/domain/workspace/PortfolioTable';
import { useDegiroStatusQuery, useSyncDegiroOrdersMutation } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';

export default function PortfolioPanel() {
  const syncMutation = useSyncDegiroOrdersMutation();
  const degiroStatusQuery = useDegiroStatusQuery();
  const degiroStatus = degiroStatusQuery.data;
  const showDegiroSync = degiroStatus?.available === true;
  const showUnavailableNotice = degiroStatusQuery.isSuccess && degiroStatus?.available === false;

  return (
    <Card variant="bordered" className="p-4 md:p-5 space-y-3 xl:h-full xl:overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('workspacePage.panels.portfolio.title')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('workspacePage.panels.portfolio.description')}
          </p>
        </div>
        {showDegiroSync ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? 'Syncing…' : 'Sync DeGiro'}
          </Button>
        ) : null}
      </div>

      {showUnavailableNotice ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-medium text-slate-900">DeGiro sync is optional</p>
          <p className="mt-1">
            Portfolio tracking still works manually. Sync DeGiro only appears when the backend has the
            connector and credentials configured.
          </p>
          <p className="mt-1 text-slate-600">{degiroStatus?.detail}</p>
        </div>
      ) : null}

      {degiroStatusQuery.isError ? (
        <p className="text-xs text-amber-600">
          Could not verify DeGiro availability. Manual portfolio tracking remains available.
        </p>
      ) : null}

      {syncMutation.isError ? (
        <p className="text-xs text-rose-600">{syncMutation.error.message}</p>
      ) : null}

      {syncMutation.isSuccess ? (
        <p className="text-xs text-emerald-600">
          {syncMutation.data.orders_created > 0 || syncMutation.data.orders_updated > 0
            ? `${syncMutation.data.orders_created} created · ${syncMutation.data.orders_updated} updated · ${syncMutation.data.fees_applied} fees applied`
            : 'Already up to date'}
          {syncMutation.data.ambiguous_skipped > 0
            ? ` · ${syncMutation.data.ambiguous_skipped} ambiguous skipped`
            : null}
        </p>
      ) : null}

      <PortfolioTable />
    </Card>
  );
}
