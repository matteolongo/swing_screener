import { RefreshCw, Database, Sparkles } from 'lucide-react';

import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
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
        title="Refresh All Universes"
        description="Pull the latest constituents for every universe snapshot from its source."
        action={
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Refreshing…' : 'Refresh All'}
          </Button>
        }
      />
      {mutation.isError ? (
        <ErrorBanner message={mutation.error instanceof Error ? mutation.error.message : 'Refresh failed.'} />
      ) : null}
      {result ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">+{result.totalAdditions} added</Badge>
            <Badge variant="error">−{result.totalRemovals} removed</Badge>
            <Badge variant="warning">{result.totalChanged} universes changed</Badge>
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
  return (
    <Card variant="bordered" className="space-y-4 p-4">
      <SectionHeader
        icon={<Database className="h-4 w-4 text-muted" />}
        title="Rebuild Pool Structure"
        description="Re-merge universe snapshots into the symbol pool. Existing enrichment is preserved."
        action={
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Rebuilding…' : 'Rebuild'}
          </Button>
        }
      />
      {mutation.isError ? (
        <ErrorBanner message={mutation.error instanceof Error ? mutation.error.message : 'Rebuild failed.'} />
      ) : null}
      {diff ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">+{diff.summary.added} added</Badge>
            <Badge variant="error">−{diff.summary.removed} removed</Badge>
            <Badge variant="warning">~{diff.summary.modified} modified</Badge>
          </div>
          <PoolDiffTable
            additions={diff.additions}
            removals={diff.removals}
            modifications={diff.modifications}
          />
        </>
      ) : null}
    </Card>
  );
}

function EnrichSection() {
  const enrich = useEnrichTaxonomy();
  const status = enrich.status;
  const running = Boolean(enrich.jobId) && (!status || status.status === 'running');
  const pct = status && status.progress.total > 0
    ? Math.round((status.progress.processed / status.progress.total) * 100)
    : 0;

  return (
    <Card variant="bordered" className="space-y-4 p-4">
      <SectionHeader
        icon={<Sparkles className="h-4 w-4 text-muted" />}
        title="Enrich Taxonomy"
        description="Refresh sector, market cap, and liquidity tiers from the data provider. This can take several minutes."
        action={
          <Button
            size="sm"
            onClick={() => enrich.start()}
            disabled={enrich.isStarting || running}
          >
            {running ? 'Enriching…' : 'Enrich'}
          </Button>
        }
      />
      {enrich.startError ? (
        <ErrorBanner message={enrich.startError instanceof Error ? enrich.startError.message : 'Failed to start enrichment.'} />
      ) : null}
      {enrich.statusError ? (
        <ErrorBanner message="Enrichment job lost — the server may have restarted. Re-run to continue." />
      ) : null}
      {status?.status === 'failed' ? (
        <ErrorBanner message={status.error || 'Enrichment failed.'} />
      ) : null}
      {running && status ? (
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-sm text-muted">
            {status.progress.processed} / {status.progress.total} symbols · {status.progress.failed} failed
          </div>
        </div>
      ) : null}
      {status?.status === 'done' && status.diff ? (
        <PoolDiffTable
          modifications={status.diff.modified}
          failedSymbols={status.diff.failedSymbols}
        />
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
