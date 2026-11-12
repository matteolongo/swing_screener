import { useCallback, useState } from 'react';
import Button from '@/components/common/Button';
import WorkspaceIntro from '@/components/layout/WorkspaceIntro';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import { useDataSources, useFallbackEvents, useProbeSourceMutation, useProbeAllMutation } from '@/features/datasources/hooks';
import SourceCard from '@/components/domain/datasources/SourceCard';
import FallbackFeed from '@/components/domain/datasources/FallbackFeed';
import CacheSection from '@/components/domain/datasources/CacheSection';
import type { DataSource } from '@/features/datasources/types';

const DOMAIN_ORDER = ['market_data', 'fundamentals', 'intelligence'] as const;

const DOMAIN_KEY: Record<string, MessageKey> = {
  market_data: 'datasources.domains.market_data',
  fundamentals: 'datasources.domains.fundamentals',
  intelligence: 'datasources.domains.intelligence',
};

export default function DataSources() {
  const sourcesQuery = useDataSources();
  const eventsQuery = useFallbackEvents();
  const probeOne = useProbeSourceMutation();
  const probeAll = useProbeAllMutation();
  const [testingId, setTestingId] = useState<string | null>(null);

  const onTest = useCallback((id: string) => {
    setTestingId(id);
    probeOne.mutate(id, { onSettled: () => setTestingId(null) });
  }, [probeOne]);

  const probeOneError = probeOne.isError
    ? probeOne.error instanceof Error ? probeOne.error.message : t('datasources.testError')
    : null;
  const probeAllError = probeAll.isError
    ? probeAll.error instanceof Error ? probeAll.error.message : t('datasources.testAllError')
    : null;

  const sources = sourcesQuery.data ?? [];
  const grouped = DOMAIN_ORDER.map((domain) => ({
    domain,
    items: sources.filter((s: DataSource) => s.domain === domain),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto min-w-0 max-w-[1440px] space-y-5 pb-8">
      <WorkspaceIntro label={t('sidebar.nav.tools')} title={t('datasources.title')} description={t('datasources.subtitle')} action={
        <Button
          type="button"
          onClick={() => probeAll.mutate()}
          disabled={probeAll.isPending}
        >
          {probeAll.isPending ? t('datasources.testing') : t('datasources.testAll')}
        </Button>
      } />
      {probeAllError ? <p role="alert" className="text-sm text-danger">{probeAllError}</p> : null}
      {probeOneError ? <p role="alert" className="text-sm text-danger">{probeOneError}</p> : null}
      {sourcesQuery.isLoading ? <p role="status" className="text-sm text-muted">{t('datasources.loading')}</p> : null}
      {sourcesQuery.isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p role="alert" className="text-sm text-warning">{t('datasources.loadError')}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => void sourcesQuery.refetch()}>{t('workspacePage.data.retry')}</Button>
        </div>
      ) : null}
      {sourcesQuery.isSuccess && sources.length === 0 ? <p role="status" className="text-sm text-muted">{t('datasources.empty')}</p> : null}

      {grouped.map((group) => (
        <section key={group.domain}>
          <h2 className="text-xs uppercase tracking-wide text-muted mb-2">
            {t(DOMAIN_KEY[group.domain] ?? 'datasources.domains.market_data')}
          </h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {group.items.map((s) => (
              <SourceCard key={s.id} source={s} onTest={onTest} testing={testingId === s.id} />
            ))}
          </div>
        </section>
      ))}

      {eventsQuery.isError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p role="alert" className="text-sm text-warning">
            {t(eventsQuery.data ? 'datasources.fallbacks.refreshError' : 'datasources.fallbacks.loadError')}
          </p>
          <Button type="button" size="sm" variant="secondary" disabled={eventsQuery.isFetching}
            onClick={() => void eventsQuery.refetch()}>
            {t('datasources.fallbacks.retry')}
          </Button>
        </div>
      ) : null}
      {eventsQuery.data ? <FallbackFeed events={eventsQuery.data} /> : null}
      <CacheSection />
    </div>
  );
}
