import { useCallback, useState } from 'react';
import { t } from '@/i18n/t';
import CacheCard from './CacheCard';
import { useCacheStatus, useClearCacheMutation } from '@/features/datasources/cacheHooks';

export default function CacheSection() {
  const { data: entries = [] } = useCacheStatus();
  const clearMutation = useClearCacheMutation();
  const [clearingId, setClearingId] = useState<string | null>(null);

  const onClear = useCallback((id: string) => {
    setClearingId(id);
    clearMutation.mutate(id, { onSettled: () => setClearingId(null) });
  }, [clearMutation]);

  return (
    <section>
      <h2 className="text-xs uppercase tracking-wide text-muted mb-2">
        {t('datasources.cache.title')}
      </h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-4">
        {entries.map((entry) => (
          <CacheCard
            key={entry.id}
            entry={entry}
            onClear={onClear}
            clearing={clearingId === entry.id}
          />
        ))}
      </div>
    </section>
  );
}
