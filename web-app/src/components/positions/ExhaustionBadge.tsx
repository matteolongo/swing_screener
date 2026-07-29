import { Activity, AlertTriangle, Flame } from 'lucide-react';

interface Props {
  score: number | null;
  timestamp?: string;
  className?: string;
}

export default function ExhaustionBadge({ score, timestamp, className = '' }: Props) {
  if (score === null) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-elevated text-text-secondary text-xs">
          <Activity size={12} />
          —
        </span>
        {timestamp && <span className="text-xs text-text-secondary">{timestamp}</span>}
      </div>
    );
  }

  let color: string;
  let label: string;
  let Icon: typeof Activity;

  if (score <= 3) {
    color = 'bg-success/20 text-success';
    label = 'Healthy';
    Icon = Activity;
  } else if (score <= 6) {
    color = 'bg-warning/20 text-warning';
    label = 'Watch';
    Icon = AlertTriangle;
  } else {
    color = 'bg-danger/20 text-danger';
    label = 'Exhausted';
    Icon = Flame;
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${color}`}>
        <Icon size={12} />
        {label}
      </span>
      {timestamp && <span className="text-xs text-text-secondary">{timestamp}</span>}
    </div>
  );
}
