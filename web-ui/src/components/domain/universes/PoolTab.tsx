import { RefreshCw, Database, Sparkles } from 'lucide-react';

import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { t } from '@/i18n/t';
import {
  useEnrichTaxonomy,
  useRebuildPool,
  useRefreshAllUniverses,
} from '@/features/pool/adminHooks';
import PoolDiffTable from './PoolDiffTable';
import UniverseRefreshSummary from './UniverseRefreshSummary';

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}

function SuccessNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
      {message}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </div>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}

function RefreshAllSection() {
  const mutation = useRefreshAllUniverses();
  const result = mutation.data;
  return (
    <Card variant="bordered" className="space-y-4 p-4">
      <SectionHeader
        icon={<RefreshCw className="h-4 w-4 text-muted" />}
        title={t('poolAdmin.refreshAll.title')}
        description={t('poolAdmin.refreshAll.description')}
        action={
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? t('poolAdmin.refreshAll.running') : t('poolAdmin.refreshAll.button')}
          </Button>
        }
      />
      {mutation.isError ? (
        <ErrorBanner
          message={mutation.error instanceof Error ? mutation.error.message : t('poolAdmin.refreshAll.error')}
        />
      ) : null}
      {result ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">{t('poolAdmin.refreshAll.added', { count: result.totalAdditions })}</Badge>
            <Badge variant="error">{t('poolAdmin.refreshAll.removed', { count: result.totalRemovals })}</Badge>
            <Badge variant="warning">{t('poolAdmin.refreshAll.changed', { count: result.totalChanged })}</Badge>
          </div>
          <UniverseRefreshSummary rows={result.universes} />
        </>
      ) : null}
    </Card>
  );
}

function RebuildSection() {
  const mutation = useRebuildPool();
  const diff = mutation.data;
  const hasChanges = diff
    ? diff.summary.added + diff.summary.removed + diff.summary.modified > 0
    : false;
  return (
    <Card variant="bordered" className="space-y-4 p-4">
      <SectionHeader
        icon={<Database className="h-4 w-4 text-muted" />}
        title={t('poolAdmin.rebuild.title')}
        description={t('poolAdmin.rebuild.description')}
        action={
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? t('poolAdmin.rebuild.running') : t('poolAdmin.rebuild.button')}
          </Button>
        }
      />
      {mutation.isError ? (
        <ErrorBanner
          message={mutation.error instanceof Error ? mutation.error.message : t('poolAdmin.rebuild.error')}
        />
      ) : null}
      {diff ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">{t('poolAdmin.rebuild.added', { count: diff.summary.added })}</Badge>
            <Badge variant="error">{t('poolAdmin.rebuild.removed', { count: diff.summary.removed })}</Badge>
            <Badge variant="warning">{t('poolAdmin.rebuild.modified', { count: diff.summary.modified })}</Badge>
          </div>
          {hasChanges ? (
            <PoolDiffTable
              additions={diff.additions}
              removals={diff.removals}
              modifications={diff.modifications}
            />
          ) : (
            <SuccessNote message={t('poolAdmin.rebuild.noChanges')} />
          )}
        </>
      ) : null}
    </Card>
  );
}

function EnrichSection() {
  const enrich = useEnrichTaxonomy();
  const status = enrich.status;
  const pct =
    status && status.progress.total > 0
      ? Math.round((status.progress.processed / status.progress.total) * 100)
      : 0;
  const doneDiff = status?.status === 'done' ? status.diff : null;
  const hasResults = Boolean(doneDiff && (doneDiff.modified.length > 0 || doneDiff.failedSymbols.length > 0));

  return (
    <Card variant="bordered" className="space-y-4 p-4">
      <SectionHeader
        icon={<Sparkles className="h-4 w-4 text-muted" />}
        title={t('poolAdmin.enrich.title')}
        description={t('poolAdmin.enrich.description')}
        action={
          <Button size="sm" onClick={() => enrich.start()} disabled={enrich.isStarting || enrich.isRunning}>
            {enrich.isRunning ? t('poolAdmin.enrich.running') : t('poolAdmin.enrich.button')}
          </Button>
        }
      />
      {enrich.startError ? (
        <ErrorBanner
          message={enrich.startError instanceof Error ? enrich.startError.message : t('poolAdmin.enrich.startError')}
        />
      ) : null}
      {enrich.statusError ? <ErrorBanner message={t('poolAdmin.enrich.statusError')} /> : null}
      {status?.status === 'failed' ? (
        <ErrorBanner message={status.error || t('poolAdmin.enrich.failed')} />
      ) : null}
      {enrich.isRunning && status ? (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-sm text-muted">
            {t('poolAdmin.enrich.progress', {
              processed: status.progress.processed,
              total: status.progress.total,
              failed: status.progress.failed,
            })}
          </div>
        </div>
      ) : null}
      {doneDiff ? (
        hasResults ? (
          <PoolDiffTable modifications={doneDiff.modified} failedSymbols={doneDiff.failedSymbols} />
        ) : (
          <SuccessNote message={t('poolAdmin.enrich.noChanges')} />
        )
      ) : null}
    </Card>
  );
}

export default function PoolTab() {
  return (
    <div className="space-y-4">
      <RefreshAllSection />
      <RebuildSection />
      <EnrichSection />
    </div>
  );
}
