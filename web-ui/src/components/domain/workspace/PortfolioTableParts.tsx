import type { PositionWithMetrics } from '@/features/portfolio/api';
import { usePositionStopPreviewQuery } from '@/features/portfolio/hooks';
import { type Order } from '@/features/portfolio/types';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

export interface PortfolioRow {
  id: string;
  ticker: string;
  status: 'open' | 'pending';
  netPnl: number | null;
  netPnlPercent: number | null;
  entryPrice: number | null;
  currentPrice: number | null;
  stopLoss: number | null;
  shares: number | null;
  position: PositionWithMetrics | null;
  order: Order | null;
}

export function formatPnlValue(pnl: number | null, pnlPercent: number | null): string {
  if (pnl == null || pnlPercent == null) return t('common.placeholders.dash');
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}${formatCurrency(pnl)} (${formatPercent(pnlPercent)})`;
}

export function formatOptionalCurrency(value: number | null): string {
  return value == null ? t('common.placeholders.dash') : formatCurrency(value);
}

export function TimeStopBadge({ position }: { position: PositionWithMetrics | null }) {
  if (!position?.timeStopWarning) return null;
  const label = t('bookPage.positions.timeStopBadge', {
    days: String(position.daysOpen),
    r: `${position.rNow >= 0 ? '+' : ''}${position.rNow.toFixed(2)}`,
  });
  return (
    <span
      className="inline-flex items-center rounded bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning"
      title={t('bookPage.positions.timeStopWarning')}
    >
      {label}
    </span>
  );
}

/** Compact actions dropdown using native <details> */
export function ActionsDropdown({ children }: { children: React.ReactNode }) {
  return (
    <details className="relative inline-block">
      <summary className="list-none cursor-pointer rounded p-1.5 hover:bg-foreground/5 text-muted select-none">
        ⋯
      </summary>
      <div className="absolute right-0 z-10 mt-1 min-w-[10rem] rounded-lg border border-border bg-surface shadow-md p-1">
        {children}
      </div>
    </details>
  );
}

export function DropdownItem({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        // close the details parent
        const details = (e.target as HTMLElement).closest('details');
        if (details) (details as HTMLDetailsElement).open = false;
        onClick();
      }}
      className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-foreground/5 ${className ?? ''}`}
    >
      {label}
    </button>
  );
}

interface StopPreviewPanelProps {
  positionId: string;
  ticker: string;
  price: number | null;
  onClose: () => void;
}

export function StopPreviewPanel({ positionId, ticker, price, onClose }: StopPreviewPanelProps) {
  const { data, isLoading, error } = usePositionStopPreviewQuery(positionId, price, true);

  let message = '';
  let messageClass = 'text-muted';

  if (data) {
    switch (data.action) {
      case 'MOVE_STOP_UP':
        message = `${t('workspacePage.panels.portfolio.intradayPreview.stopCanRaise')} ${formatCurrency(data.stopSuggested)}`;
        messageClass = 'text-success font-semibold';
        break;
      case 'CLOSE_STOP_HIT':
        message = t('workspacePage.panels.portfolio.intradayPreview.stopHit');
        messageClass = 'text-danger font-semibold';
        break;
      case 'CLOSE_EXIT_SIGNAL':
        message = t('workspacePage.panels.portfolio.intradayPreview.exitSignal');
        messageClass = 'text-warning font-semibold';
        break;
      case 'CLOSE_TIME_EXIT':
        message = t('workspacePage.panels.portfolio.intradayPreview.timeExit');
        messageClass = 'text-warning font-semibold';
        break;
      default:
        message = t('workspacePage.panels.portfolio.intradayPreview.noChange');
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-primary">
          {ticker} — {t('workspacePage.panels.portfolio.intradayPreview.checkLive')}
          {price != null && (
            <span className="ml-1 font-mono text-xs text-primary">
              @ {formatCurrency(price)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-primary hover:text-primary text-xs"
          aria-label="Close preview"
        >
          ✕
        </button>
      </div>
      {isLoading && (
        <p className="mt-1 text-primary text-xs">
          {t('workspacePage.panels.portfolio.intradayPreview.loading')}
        </p>
      )}
      {error && (
        <p className="mt-1 text-danger text-xs">{error.message}</p>
      )}
      {data && !isLoading && (
        <div className="mt-1 space-y-0.5">
          <p className={messageClass}>{message}</p>
          {data.reason && (
            <p className="text-xs text-muted">{data.reason}</p>
          )}
          <p className="text-xs text-muted font-mono">
            R: {data.rNow >= 0 ? '+' : ''}{data.rNow.toFixed(2)} · live {formatCurrency(data.last)}
          </p>
          {data.exhaustionScore != null && data.exhaustionLabel != null && (
            <p className={`text-xs font-medium ${
              data.exhaustionLabel === 'exit' ? 'text-danger' :
              data.exhaustionLabel === 'watch' ? 'text-warning' :
              'text-success'
            }`}>
              {data.exhaustionLabel === 'exit' ? '🔴' : data.exhaustionLabel === 'watch' ? '🟡' : '🟢'}{' '}
              {t('workspacePage.panels.portfolio.intradayPreview.exhaustion', {
                label: data.exhaustionLabel,
                score: data.exhaustionScore.toFixed(1),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
