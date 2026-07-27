import type { WorkspaceSourceState } from '@/features/workspaceData/types';
import { t } from '@/i18n/t';

interface DataStatusBarProps {
  sources: WorkspaceSourceState[];
}

export default function DataStatusBar({ sources }: DataStatusBarProps) {
  const isLoading = sources.some(({ phase }) => phase === 'loading');

  return (
    <div
      data-testid="workspace-data-status"
      className="flex shrink-0 gap-2 overflow-x-auto border-y border-border py-2 text-xs text-muted"
      aria-live={isLoading ? 'polite' : undefined}
    >
      {sources.map((source) => (
        <div
          key={source.id}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1"
        >
          <span>{t(`workspacePage.data.sources.${source.id}`)}</span>
          <span className="font-medium text-foreground">
            {t(`workspacePage.data.phases.${source.phase}`)}
          </span>
          {source.provider ? <span>{source.provider}</span> : null}
          {source.fetchedAt ? <time dateTime={source.fetchedAt}>{new Date(source.fetchedAt).toLocaleString()}</time> : null}
        </div>
      ))}
    </div>
  );
}
