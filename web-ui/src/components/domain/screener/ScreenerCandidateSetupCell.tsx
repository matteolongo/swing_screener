import { CandidateViewModel } from '@/features/screener/viewModel';
import { formatCurrency } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface ScreenerCandidateSetupCellProps {
  candidate: CandidateViewModel;
}

/**
 * Setup cell showing entry, stop, R/R, and risk $ in a compact stacked layout
 */
export default function ScreenerCandidateSetupCell({
  candidate,
}: ScreenerCandidateSetupCellProps) {
  return (
    <div className="text-xs space-y-0.5">
      {/* Entry */}
      <div className="flex justify-between gap-4">
        <span className="text-gray-600 dark:text-gray-400">{t('screener.setup.entry')}:</span>
        <span className="font-mono">
          {candidate.entry != null && candidate.entry > 0
            ? formatCurrency(candidate.entry, candidate.currency)
            : '—'}
        </span>
      </div>

      {/* Stop */}
      <div className="flex justify-between gap-4">
        <span className="text-gray-600 dark:text-gray-400">{t('screener.setup.stop')}:</span>
        <span className="font-mono">
          {candidate.stop != null && candidate.stop > 0
            ? formatCurrency(candidate.stop, candidate.currency)
            : '—'}
        </span>
      </div>

      {/* R/R */}
      <div className="flex justify-between gap-4">
        <span className="text-gray-600 dark:text-gray-400">{t('screener.setup.rr')}:</span>
        <span className="font-mono">
          {candidate.rr != null && candidate.rr > 0
            ? candidate.rr.toFixed(2)
            : '—'}
        </span>
      </div>

      {/* Risk $ */}
      <div className="flex justify-between gap-4">
        <span className="text-gray-600 dark:text-gray-400">{t('screener.setup.riskDollar')}:</span>
        <span className="font-mono">
          {candidate.riskUsd != null && candidate.riskUsd > 0
            ? formatCurrency(candidate.riskUsd, 'USD')
            : '—'}
        </span>
      </div>
    </div>
  );
}
