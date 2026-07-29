import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { requestPositionReview } from '../../services/api/aiApi';

interface Props {
  positionId: string;
  symbol: string;
}

interface PositionReviewData {
  move_explanation: string;
  thesis_status: string;
  profit_protection_guidance: string;
  stop_advice: string;
  stop_price?: number;
  macro_overlay: string;
}

function statusColor(status: string): string {
  switch (status) {
    case 'confirmed': return 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30';
    case 'contradicted': return 'bg-[var(--danger)]/20 text-[var(--danger)] border-[var(--danger)]/30';
    default: return 'bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30';
  }
}

export default function PositionReview({ positionId, symbol }: Props) {
  const [data, setData] = useState<PositionReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    requestPositionReview(positionId)
      .then((res) => {
        if (!cancelled) setData(res as PositionReviewData);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [positionId]);

  if (isLoading) {
    return (
      <div className="px-4 py-3 rounded bg-[var(--bg-surface)] border border-[var(--border)]">
        <p className="text-xs text-[var(--text-secondary)]">Loading position review...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 py-3 rounded bg-[var(--bg-surface)] border border-[var(--border)]">
        <p className="text-xs text-[var(--danger)]">Could not load position review</p>
      </div>
    );
  }

  return (
    <div className="rounded bg-[var(--bg-surface)] border border-[var(--border)]">
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2">
        <span className="text-xs font-semibold text-[var(--text-primary)]">Position Review</span>
        <span className="text-xs text-[var(--text-secondary)]">— {symbol}</span>
      </div>
      <div className="p-4 flex flex-col gap-3 text-xs">
        <div>
          <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">Move Explanation</h4>
          <p className="text-[var(--text-primary)]">{data.move_explanation}</p>
        </div>

        <div className="flex items-start gap-2">
          <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase shrink-0 mt-0.5">Thesis Status</h4>
          <span className={clsx('px-2 py-0.5 rounded text-[10px] font-semibold border', statusColor(data.thesis_status))}>
            {data.thesis_status}
          </span>
        </div>

        <div>
          <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">Profit Protection</h4>
          <p className="text-[var(--text-primary)]">{data.profit_protection_guidance}</p>
        </div>

        <div>
          <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">Stop Advice</h4>
          <p className="text-[var(--text-primary)]">
            {data.stop_advice}
            {data.stop_price && (
              <span className="text-[var(--accent)] font-mono ml-1">(${data.stop_price.toFixed(2)})</span>
            )}
          </p>
        </div>

        <div>
          <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">Macro Overlay</h4>
          <p className="text-[var(--text-primary)]">{data.macro_overlay}</p>
        </div>
      </div>
    </div>
  );
}
