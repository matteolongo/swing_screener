import clsx from 'clsx';
import { Circle } from 'lucide-react';
import type { Position } from '../../types/api';
import { usePortfolioStore } from '../../store/usePortfolioStore';

interface Props {
  positions: Position[];
  isLoading: boolean;
}

function plR(position: Position): number {
  if (position.rr_to_target === 0) return 0;
  if (position.direction === 'short') {
    const denominator = position.entry_price - position.target_price;
    if (denominator === 0) return 0;
    return (position.entry_price - position.current_price) * position.rr_to_target / denominator;
  }
  const denominator = position.target_price - position.entry_price;
  if (denominator === 0) return 0;
  return (position.current_price - position.entry_price) * position.rr_to_target / denominator;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="py-2.5 px-3">
          <div className="h-3 w-12 bg-elevated rounded" />
        </td>
      ))}
    </tr>
  );
}

export default function PositionsList({ positions, isLoading }: Props) {
  const setSelectedPositionId = usePortfolioStore((s) => s.setSelectedPositionId);
  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Open Positions</h3>
        <table className="w-full text-left">
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Open Positions</h3>
        <div className="text-sm text-text-secondary py-4 text-center">No open positions</div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-text-primary mb-2">Open Positions</h3>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11px] text-text-secondary uppercase border-b border-border">
            <th className="py-1.5 px-2 font-medium">Ticker</th>
            <th className="py-1.5 px-2 font-medium">Dir</th>
            <th className="py-1.5 px-2 font-medium">Entry</th>
            <th className="py-1.5 px-2 font-medium">Price</th>
            <th className="py-1.5 px-2 font-medium">P&L (R)</th>
            <th className="py-1.5 px-2 font-medium">Stop</th>
            <th className="py-1.5 px-2 font-medium">Trail</th>
            <th className="py-1.5 px-2 font-medium">Exh</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const r = plR(p);
            const stopHit = p.distance_to_stop <= 0;
            const score = p.last_exhaustion_score ?? 0;
            const exhColor = score < 3 ? 'text-success' : score < 7 ? 'text-warning' : 'text-danger';

            return (
              <tr
                key={p.position_id}
                className="border-b border-border hover:bg-elevated transition-colors cursor-pointer"
                onClick={() => setSelectedPositionId(p.position_id)}
              >
                <td className="py-2 px-2 font-medium text-text-primary">{p.ticker}</td>
                <td className="py-2 px-2">
                  <span
                    className={clsx(
                      'inline-block px-1.5 py-0.5 rounded text-[11px] font-medium',
                      p.direction === 'long' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger',
                    )}
                  >
                    {p.direction === 'long' ? 'LONG' : 'SHORT'}
                  </span>
                </td>
                <td className="py-2 px-2 price-font">{p.entry_price.toFixed(2)}</td>
                <td className="py-2 px-2 price-font">{p.current_price.toFixed(2)}</td>
                <td className={clsx('py-2 px-2 price-font font-medium', r >= 0 ? 'text-success' : 'text-danger')}>
                  {r >= 0 ? '+' : ''}{r.toFixed(2)}
                </td>
                <td className="py-2 px-2">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Circle size={8} fill={stopHit ? 'var(--danger)' : 'var(--success)'} color={stopHit ? 'var(--danger)' : 'var(--success)'} />
                    <span className={stopHit ? 'text-danger' : 'text-success'}>
                      {stopHit ? 'Hit' : 'Active'}
                    </span>
                  </span>
                </td>
                <td className="py-2 px-2">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-elevated text-text-secondary text-[11px]">
                    {p.trail_method || 'Manual'}
                  </span>
                </td>
                <td className={clsx('py-2 px-2 text-[11px] font-medium', exhColor)}>
                  {p.last_exhaustion_label ?? score.toFixed(0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
