import clsx from 'clsx';
import { Circle, Zap } from 'lucide-react';
import type { CandidateRow as CandidateRowType } from '../../types/api';

interface Props {
  candidate: CandidateRowType;
  isHeld?: boolean;
  onAnalyze?: () => void;
  simplified?: boolean;
}

function rrColor(rr: number): string {
  if (rr >= 2.0) return 'text-success';
  if (rr >= 1.5) return 'text-warning';
  return 'text-danger';
}

function setupColor(setup: string): string {
  const s = setup.toLowerCase();
  if (s === 'breakout') return 'bg-success/20 text-success';
  if (s === 'pullback') return 'bg-accent/20 text-accent';
  return 'bg-bg-elevated text-text-secondary';
}

function gainColor(gain: number): string {
  return gain >= 0 ? 'text-success' : 'text-danger';
}

export default function CandidateRow({ candidate, isHeld, onAnalyze, simplified }: Props) {
  const c = candidate;

  return (
    <tr className="border-b border-border hover:bg-[var(--bg-elevated)] transition-colors text-[13px]">
      <td className="py-2 px-3 text-text-secondary">{c.rank}</td>

      <td className="py-2 px-3">
        <span className="font-medium text-text-primary">{c.symbol}</span>
        <span className="ml-1.5 text-[11px] text-text-secondary">{c.exchange_mic}</span>
      </td>

      <td className="py-2 px-3">
        <span className={clsx('inline-block px-2 py-0.5 rounded text-[11px] font-medium', setupColor(c.setup))}>
          {c.setup}
        </span>
      </td>

      {!simplified && <td className="py-2 px-3 price-font">{c.entry.toFixed(2)}</td>}
      {!simplified && <td className="py-2 px-3 price-font">{c.stop.toFixed(2)}</td>}

      <td className={clsx('py-2 px-3 price-font font-medium', rrColor(c.rr))} data-testid="rr-cell">
        {c.rr.toFixed(2)}
      </td>

      {!simplified && <td className="py-2 px-3 price-font">${c.risk_usd.toFixed(0)}</td>}
      {!simplified && <td className="py-2 px-3 price-font">{c.shares}</td>}

      {!simplified && (
        <td className="py-2 px-3">
          <span className="inline-block px-1.5 py-0.5 rounded bg-bg-elevated text-text-secondary text-[11px]">
            {c.sector}
          </span>
        </td>
      )}

      <td className="py-2 px-3 price-font">{c.price.toFixed(2)}</td>

      {!simplified && <td className="py-2 px-3 price-font text-text-secondary">{c.close.toFixed(2)}</td>}

      {!simplified && (
        <td className="py-2 px-3">
          {c.catalyst && (
            <span className="flex items-center gap-1 text-text-secondary text-[11px]">
              <Zap size={12} />
              {c.catalyst}
            </span>
          )}
        </td>
      )}

      {!simplified && (
        <td className="py-2 px-3 price-font">
          {c.gain !== undefined && (
            <span className={clsx('font-medium', gainColor(c.gain))}>
              {c.gain >= 0 ? '+' : ''}{c.gain.toFixed(1)}%
            </span>
          )}
        </td>
      )}

      {!simplified && (
        <td className="py-2 px-3" data-testid="held-cell">
          {isHeld && (
            <Circle size={10} fill="#3b82f6" color="#3b82f6" />
          )}
        </td>
      )}

      <td className="py-2 px-3">
        <button
          onClick={onAnalyze}
          className={clsx(
            'text-[11px] px-2 py-1 rounded border transition-colors',
            simplified
              ? 'border-border text-text-secondary opacity-50 cursor-not-allowed'
              : 'border-border text-text-secondary hover:text-accent hover:border-accent',
          )}
          disabled={simplified}
        >
          Analyze
        </button>
      </td>
    </tr>
  );
}
