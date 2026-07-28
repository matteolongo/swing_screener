import { ArrowLeft, ChevronsRight, Maximize2, Minimize2, RefreshCw, X } from 'lucide-react';

import { t } from '@/i18n/t';
import type { WorkspaceHealth } from '@/features/workspaceData/types';

interface SymbolWorkspaceHeaderProps {
  ticker: string;
  fullscreen: boolean;
  onClose: () => void;
  onCollapse: () => void;
  onFullscreenChange: (fullscreen: boolean) => void;
  companyName?: string | null;
  mode?: 'candidate' | 'position' | 'research';
  runAsOf?: string | null;
  runFreshness?: 'final_close' | 'intraday' | null;
  health?: WorkspaceHealth;
  isRefreshing?: boolean;
  onRefreshAll?: () => void;
}

export default function SymbolWorkspaceHeader({
  ticker,
  fullscreen,
  onClose,
  onCollapse,
  onFullscreenChange,
  companyName = null,
  mode = 'research',
  runAsOf = null,
  runFreshness = null,
  health = 'fresh',
  isRefreshing = false,
  onRefreshAll,
}: SymbolWorkspaceHeaderProps) {
  const controlClass =
    'inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-foreground/5 hover:text-foreground';

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface/95 py-2 backdrop-blur">
      <button
        type="button"
        className={`${controlClass} xl:hidden`}
        onClick={onCollapse}
        aria-label={t('workspacePage.controls.backToList')}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold text-foreground">
          {ticker}{companyName ? ` · ${companyName}` : ''}
        </h2>
        <div className="flex flex-wrap gap-x-2 text-xs text-muted">
          <span>{t(`workspacePage.header.${mode}Mode`)}</span>
          {runAsOf ? <span>{t('workspacePage.header.runAsOf', { date: runAsOf })}</span> : null}
          {runFreshness ? (
            <span>{t(`workspacePage.panels.screener.freshness.${runFreshness === 'final_close' ? 'finalClose' : 'intraday'}`)}</span>
          ) : null}
          <span>
            {t('workspacePage.header.health', {
              health: t(`workspacePage.header.healthValues.${health}`),
            })}
          </span>
        </div>
      </div>
      {onRefreshAll ? (
        <button
          type="button"
          className={controlClass}
          onClick={onRefreshAll}
          disabled={isRefreshing}
          aria-label={t('workspacePage.controls.refreshAll')}
        >
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      ) : null}
      <button
        type="button"
        className={`${controlClass} hidden xl:inline-flex`}
        onClick={onCollapse}
        aria-label={t('workspacePage.controls.collapse')}
      >
        <ChevronsRight aria-hidden="true" className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={controlClass}
        onClick={() => onFullscreenChange(!fullscreen)}
        aria-label={
          fullscreen
            ? t('workspacePage.controls.exitFullscreen')
            : t('workspacePage.controls.fullscreen')
        }
      >
        {fullscreen ? (
          <Minimize2 aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Maximize2 aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        className={controlClass}
        onClick={onClose}
        aria-label={t('workspacePage.controls.close')}
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </header>
  );
}
