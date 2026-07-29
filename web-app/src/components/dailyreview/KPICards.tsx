import clsx from 'clsx';
import type { KPI, Position, CandidateRow, AlertItem } from '../../types/api';

interface Props {
  kpis: KPI[];
  positions: Position[];
  candidates: CandidateRow[];
  alerts: AlertItem[];
  accountSize: number;
  isLoading: boolean;
}

function SkeletonCard() {
  return (
    <div className="bg-surface rounded-lg p-3 animate-pulse">
      <div className="h-3 w-16 bg-elevated rounded mb-2" />
      <div className="h-6 w-24 bg-elevated rounded" />
      <div className="h-3 w-20 bg-elevated rounded mt-1" />
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  interactive,
}: {
  label: string;
  value: string;
  detail?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={clsx(
        'bg-surface rounded-lg p-3',
        interactive && 'cursor-pointer hover:bg-elevated transition-colors',
      )}
    >
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-lg font-semibold text-text-primary mt-0.5">{value}</div>
      {detail && <div className="text-xs text-text-secondary mt-0.5">{detail}</div>}
    </div>
  );
}

export default function KPICards({ kpis, positions, candidates, alerts, accountSize, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const posCount = positions.length;
  const totalValue = positions.reduce((sum, p) => sum + p.market_value, 0);
  const avgRR = positions.length > 0
    ? positions.reduce((sum, p) => sum + p.rr_to_target, 0) / positions.length
    : 0;

  const candidateCount = candidates.length;
  const newCount = kpis.find((k) => k.label.toLowerCase().includes('new'))?.value ?? 0;

  const alertCount = alerts.length;

  const used = totalValue;
  const remaining = accountSize - used;

  return (
    <div className="grid grid-cols-4 gap-3">
      <KpiCard
        label="Open Positions"
        value={`${posCount} positions`}
        detail={totalValue > 0 ? `$${totalValue.toLocaleString()} · R ${avgRR.toFixed(2)}` : undefined}
        interactive
      />
      <KpiCard
        label="Screener Candidates"
        value={`${candidateCount} candidates`}
        detail={typeof newCount === 'number' && newCount > 0 ? `${newCount} new` : undefined}
      />
      <KpiCard
        label="Active Alerts"
        value={`${alertCount} alerts`}
        interactive
      />
      <KpiCard
        label="Account"
        value={`$${accountSize.toLocaleString()}`}
        detail={`$${used.toLocaleString()} used · $${remaining.toLocaleString()} remaining`}
      />
    </div>
  );
}
