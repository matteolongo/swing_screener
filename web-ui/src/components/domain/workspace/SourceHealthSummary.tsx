import type { WorkspaceSourceState } from '@/features/workspaceData/types';
import { t } from '@/i18n/t';

export default function SourceHealthSummary({ sources }: { sources: WorkspaceSourceState[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 text-xs" role="status" aria-label={t('workspacePage.data.activity')}>
      {sources.map((source) => (
        <span key={source.id} className="rounded-full bg-foreground/5 px-2.5 py-1 text-muted">
          {t(`workspacePage.data.sources.${source.id}`)}:{' '}
          <strong className="text-foreground">{t(`workspacePage.data.phases.${source.phase}`)}</strong>
          {source.provider ? ` · ${source.provider}` : ''}
        </span>
      ))}
    </div>
  );
}
