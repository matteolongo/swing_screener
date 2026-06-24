import { useCallback, useState } from 'react';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import { useDataSources, useFallbackEvents, useProbeSourceMutation, useProbeAllMutation } from '@/features/datasources/hooks';
import SourceCard from '@/components/domain/datasources/SourceCard';
import FallbackFeed from '@/components/domain/datasources/FallbackFeed';
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

  const sources = sourcesQuery.data ?? [];
  const grouped = DOMAIN_ORDER.map((domain) => ({
    domain,
    items: sources.filter((s: DataSource) => s.domain === domain),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t('datasources.title')}</h1>
          <p className="text-xs text-muted">{t('datasources.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => probeAll.mutate()}
          disabled={probeAll.isPending}
          className="text-xs font-medium text-primary hover:underline disabled:text-muted"
        >
          {probeAll.isPending ? t('datasources.testing') : t('datasources.testAll')}
        </button>
      </header>

      {grouped.map((group) => (
        <section key={group.domain}>
          <h2 className="text-xs uppercase tracking-wide text-muted mb-2">
            {t(DOMAIN_KEY[group.domain] ?? 'datasources.domains.market_data')}
          </h2>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
            {group.items.map((s) => (
              <SourceCard key={s.id} source={s} onTest={onTest} testing={testingId === s.id} />
            ))}
          </div>
        </section>
      ))}

      <FallbackFeed events={eventsQuery.data ?? []} />
    </div>
  );
}
