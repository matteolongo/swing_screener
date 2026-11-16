import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/formatters';
import type { MessageKey } from '@/i18n/types';
import type { DataSource } from '@/features/datasources/types';

interface Props {
  source: DataSource;
  onTest: (id: string) => void;
  testing: boolean;
}

const STATUS_KEY: Record<string, MessageKey> = {
  ok: 'datasources.status.ok',
  degraded: 'datasources.status.degraded',
  down: 'datasources.status.down',
  not_configured: 'datasources.status.not_configured',
};

const STATUS_CLASS: Record<string, string> = {
  ok: 'text-success',
  degraded: 'text-warning',
  down: 'text-danger',
  not_configured: 'text-muted',
};

export default function SourceCard({ source, onTest, testing }: Props) {
  const probe = source.lastProbe;
  return (
    <div className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{source.displayName}</span>
        <span className="text-[11px] uppercase tracking-wide text-muted">{source.role}</span>
      </div>
      {source.note && <span className="text-xs text-muted">{source.note}</span>}
      {source.id === 'finnhub' && (
        <p className="text-xs text-muted">{t('datasources.quoteProbeScope')}</p>
      )}
      {!source.configured && !source.note && (
        <span className="text-xs text-muted">{t('datasources.notConfigured')}</span>
      )}
      {probe && (
        <span className={cn('text-xs', STATUS_CLASS[probe.status] ?? 'text-muted')}>
          {t(STATUS_KEY[probe.status] ?? 'datasources.status.not_configured')}
          {probe.latencyMs != null ? ` · ${Math.round(probe.latencyMs)}ms` : ''}
          {probe.detail ? ` · ${probe.detail}` : ''}
        </span>
      )}
      {probe?.error && (
        <span className="break-words text-xs text-danger">{t('datasources.probeError', { message: probe.error })}</span>
      )}
      {probe?.checkedAt && (
        <span className="text-[11px] text-muted">{t('datasources.checkedAt', { time: formatDateTime(probe.checkedAt) })}</span>
      )}
      <div>
        <button
          type="button"
          disabled={!source.probeable || testing}
          onClick={() => onTest(source.id)}
          className="text-xs font-medium text-primary disabled:text-muted disabled:cursor-not-allowed hover:underline"
        >
          {source.probeable ? (testing ? t('datasources.testing') : t('datasources.test')) : t('datasources.notProbeable')}
        </button>
      </div>
    </div>
  );
}
