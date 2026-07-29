export interface TrailData {
  method: 'SMA20' | 'ATR' | 'fixed' | 'manual';
  level: number;
  lastActionTimestamp?: string;
  lastActionType?: string;
  active: boolean;
}

interface Props {
  trail: TrailData | null;
}

export default function TrailStatus({ trail }: Props) {
  if (!trail || !trail.active) {
    return (
      <div className="border border-border rounded-lg p-3">
        <p className="text-sm text-text-secondary italic">No active trail.</p>
      </div>
    );
  }

  const methodColors: Record<string, string> = {
    SMA20: 'bg-accent/20 text-accent',
    ATR: 'bg-warning/20 text-warning',
    fixed: 'bg-text-secondary/20 text-text-secondary',
    manual: 'bg-text-secondary/20 text-text-secondary',
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium ${methodColors[trail.method] || 'bg-elevated text-text-secondary'}`}>
          {trail.method}
        </span>
        <span className="font-mono text-sm text-text-primary">{trail.level.toFixed(2)}</span>
      </div>
      {trail.lastActionTimestamp && (
        <p className="text-xs text-text-secondary">
          Last trailing: {trail.lastActionTimestamp}
          {trail.lastActionType ? ` \u2014 ${trail.lastActionType}` : ''}
        </p>
      )}
    </div>
  );
}
