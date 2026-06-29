import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatRelativeTime } from '@/utils/formatters';
import type { CacheStatusEntry } from '@/features/datasources/cacheApi';

const STORAGE_CLASS: Record<string, string> = {
  disk_json: 'text-success',
  disk_parquet: 'text-primary',
  memory: 'text-[#A855F7]',
};

interface Props {
  entry: CacheStatusEntry;
  onClear: (id: string) => void;
  clearing: boolean;
}

export default function CacheCard({ entry, onClear, clearing }: Props) {
  const storageLabel = t(
    `datasources.cache.storage.${entry.storage}` as Parameters<typeof t>[0],
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{entry.label}</span>
        <span className={cn('text-[11px] font-medium', STORAGE_CLASS[entry.storage] ?? 'text-muted')}>
          {storageLabel}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 text-xs text-muted">
        <span>{t('datasources.cache.ttlLabel')}: {entry.ttlDescription}</span>
        <span>
          {t('datasources.cache.lastModifiedLabel')}:{' '}
          {entry.lastModifiedAt ? formatRelativeTime(entry.lastModifiedAt) : t('datasources.cache.neverModified')}
        </span>
        {entry.entryCount != null && (
          <span>{t('datasources.cache.entries', { count: String(entry.entryCount) })}</span>
        )}
      </div>
      <div>
        {entry.canClear ? (
          <button
            type="button"
            disabled={clearing}
            onClick={() => onClear(entry.id)}
            className="text-xs font-medium text-primary disabled:text-muted disabled:cursor-not-allowed hover:underline"
          >
            {clearing ? t('datasources.cache.clearing') : t('datasources.cache.clear')}
          </button>
        ) : (
          <span className="text-xs text-muted italic">{t('datasources.cache.clearsOnRestart')}</span>
        )}
      </div>
    </div>
  );
}
