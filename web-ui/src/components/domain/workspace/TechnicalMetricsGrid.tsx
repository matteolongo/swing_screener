import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { formatPercent } from '@/utils/formatters';

interface TechnicalMetricsGridProps {
  candidate: SymbolAnalysisCandidate;
}

export default function TechnicalMetricsGrid({ candidate }: TechnicalMetricsGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: 'ATR', value: candidate.atr != null ? candidate.atr.toFixed(2) : null },
        { label: 'SMA 20', value: candidate.sma20 != null ? candidate.sma20.toFixed(2) : null },
        { label: 'SMA 50', value: candidate.sma50 != null ? candidate.sma50.toFixed(2) : null },
        { label: 'SMA 200', value: candidate.sma200 != null ? candidate.sma200.toFixed(2) : null },
        {
          label: 'Mom 6M',
          value: candidate.momentum6m != null ? formatPercent(candidate.momentum6m * 100) : null,
        },
        {
          label: 'Mom 12M',
          value: candidate.momentum12m != null ? formatPercent(candidate.momentum12m * 100) : null,
        },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-md border border-gray-200 bg-white px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-0.5 text-xs font-mono font-semibold text-gray-800 dark:text-gray-200">{value ?? '—'}</p>
        </div>
      ))}
    </div>
  );
}
