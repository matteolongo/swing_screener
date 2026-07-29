import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { usePortfolioStore } from '../../store/usePortfolioStore';

const dotColors: Record<string, string> = {
  exhaustion: 'bg-warning',
  'stop-trigger': 'bg-danger',
  concentration: 'bg-warning',
  'provider-failure': 'bg-text-secondary',
  'intraday-rr': 'bg-accent',
};

export default function AlertStrip() {
  const { alerts, dismissAlert } = useAppStore();
  const setSelectedPositionId = usePortfolioStore((s) => s.setSelectedPositionId);

  if (alerts.length === 0) return null;

  const handleAlertClick = (alert: { type: string; positionId?: string; symbol?: string }) => {
    if ((alert.type === 'stop-trigger' || alert.type === 'exhaustion') && alert.positionId) {
      setSelectedPositionId(alert.positionId);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-bg-surface border-b border-border text-xs">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={() => handleAlertClick(alert)}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${dotColors[alert.type] || 'bg-text-secondary'}`} />
          <span className="text-text-secondary">{alert.message}</span>
          <button onClick={(e) => { e.stopPropagation(); dismissAlert(alert.id); }} className="text-text-secondary hover:text-text-primary ml-1">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
