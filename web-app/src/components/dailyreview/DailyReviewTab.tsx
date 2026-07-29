import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import { useDailyReview } from '../../hooks/useDailyReview';
import KPICards from './KPICards';
import PositionsList from './PositionsList';
import ScreenerResultsList from './ScreenerResultsList';
import StepTracker from './StepTracker';
import type { AlertItem, Position } from '../../types/api';

function severityColor(type: string): string {
  if (type === 'exhaustion' || type === 'stop-trigger') return 'border-danger';
  if (type === 'concentration') return 'border-warning';
  return 'border-accent';
}

function PositionsPreview({ positions, isLoading }: { positions: Position[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Positions Preview</h3>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-elevated rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Positions Preview</h3>
        <div className="text-sm text-text-secondary py-4 text-center">No open positions</div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-text-primary mb-2">Positions Preview</h3>
      <div className="space-y-1">
        {positions.map((p) => {
          const plDollars = p.unrealized_pl;
          const plPct = p.entry_price > 0 ? (plDollars / (p.shares * p.entry_price)) * 100 : 0;
          const isPositive = plDollars >= 0;

          return (
            <div
              key={p.position_id}
              className="flex items-center gap-3 px-3 py-2 rounded bg-surface text-[13px]"
            >
              <span className="font-medium text-text-primary w-16">{p.ticker}</span>
              <span className="text-text-secondary flex-1">
                ${p.current_price.toFixed(2)}
              </span>
              <span className={clsx('font-medium w-24 text-right', isPositive ? 'text-success' : 'text-danger')}>
                {isPositive ? '+' : ''}${plDollars.toFixed(0)}
              </span>
              <span className={clsx('font-medium w-16 text-right', isPositive ? 'text-success' : 'text-danger')}>
                {isPositive ? '+' : ''}{plPct.toFixed(1)}%
              </span>
              <span
                className={clsx(
                  'inline-block px-1.5 py-0.5 rounded text-[11px] font-medium',
                  p.direction === 'long' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger',
                )}
              >
                {p.direction === 'long' ? 'LONG' : 'SHORT'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DailyReviewTab() {
  const { kpis, positions, candidates, alerts, steps, isLoading } = useDailyReview();
  const accountSize = useAppStore((s) => s.accountSize);
  const mode = useAppStore((s) => s.mode);
  const isIntraday = mode === 'intraday';

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className={clsx('grid gap-3', isIntraday ? 'grid-cols-2' : 'grid-cols-4')}>
        <div className="bg-surface rounded-lg p-3">
          <div className="text-xs text-text-secondary">Open Positions</div>
          <div className="text-lg font-semibold text-text-primary mt-0.5">
            {isLoading ? '—' : `${positions.length} positions`}
          </div>
          {!isLoading && positions.length > 0 && (
            <div className="text-xs text-text-secondary mt-0.5">
              ${positions.reduce((s, p) => s + p.market_value, 0).toLocaleString()}
            </div>
          )}
        </div>
        <div className="bg-surface rounded-lg p-3">
          <div className="text-xs text-text-secondary">Active Alerts</div>
          <div className="text-lg font-semibold text-text-primary mt-0.5">
            {isLoading ? '—' : `${alerts.length} alerts`}
          </div>
        </div>
      </div>

      {!isIntraday && (
        <KPICards
          kpis={kpis}
          positions={positions}
          candidates={candidates}
          alerts={alerts}
          accountSize={accountSize}
          isLoading={isLoading}
        />
      )}

      {isIntraday ? (
        <div className="grid grid-cols-2 gap-4">
          <PositionsList positions={positions} isLoading={isLoading} />
          <PositionsPreview positions={positions} isLoading={isLoading} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <PositionsList positions={positions} isLoading={isLoading} />
          <ScreenerResultsList candidates={candidates} isLoading={isLoading} />
        </div>
      )}

      {alerts.length > 0 && !isLoading && (
        <div className="bg-surface rounded-lg p-3">
          <h3 className="text-sm font-medium text-text-primary mb-2">Active Alerts</h3>
          <div className="space-y-1.5">
            {alerts.map((alert: AlertItem) => (
              <div
                key={alert.id}
                className={`flex items-start gap-2 pl-2 border-l-2 ${severityColor(alert.type)} py-1`}
              >
                <div className="text-xs text-text-secondary">
                  {alert.symbol && <span className="font-medium text-text-primary">{alert.symbol}: </span>}
                  {alert.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <StepTracker steps={steps} isLoading={isLoading} />
    </div>
  );
}
