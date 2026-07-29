import { useAppStore } from '../../store/useAppStore';
import { useDailyReview } from '../../hooks/useDailyReview';
import KPICards from './KPICards';
import PositionsList from './PositionsList';
import ScreenerResultsList from './ScreenerResultsList';
import StepTracker from './StepTracker';
import type { AlertItem } from '../../types/api';

function severityColor(type: string): string {
  if (type === 'exhaustion' || type === 'stop-trigger') return 'border-danger';
  if (type === 'concentration') return 'border-warning';
  return 'border-accent';
}

export default function DailyReviewTab() {
  const { kpis, positions, candidates, alerts, steps, isLoading } = useDailyReview();
  const accountSize = useAppStore((s) => s.accountSize);

  return (
    <div className="flex flex-col gap-4 p-4">
      <KPICards
        kpis={kpis}
        positions={positions}
        candidates={candidates}
        alerts={alerts}
        accountSize={accountSize}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-2 gap-4">
        <PositionsList positions={positions} isLoading={isLoading} />
        <ScreenerResultsList candidates={candidates} isLoading={isLoading} />
      </div>

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
