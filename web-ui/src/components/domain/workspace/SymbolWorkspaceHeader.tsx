import { ArrowLeft, ChevronsRight, Maximize2, Minimize2, X } from 'lucide-react';

import { t } from '@/i18n/t';

interface SymbolWorkspaceHeaderProps {
  ticker: string;
  fullscreen: boolean;
  onClose: () => void;
  onCollapse: () => void;
  onFullscreenChange: (fullscreen: boolean) => void;
}

export default function SymbolWorkspaceHeader({
  ticker,
  fullscreen,
  onClose,
  onCollapse,
  onFullscreenChange,
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
      <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{ticker}</h2>
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
