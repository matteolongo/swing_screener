import { useState } from 'react';
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import Button from '@/components/common/Button';
import TableShell from '@/components/common/TableShell';
import { ScreenerCandidate } from '@/features/screener/types';
import { toCandidateViewModel, hasFixes } from '@/features/screener/viewModel';
import ScreenerCandidateIdentityCell from './ScreenerCandidateIdentityCell';
import ScreenerCandidateSetupCell from './ScreenerCandidateSetupCell';
import ScreenerCandidateDetailsRow from './ScreenerCandidateDetailsRow';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface ScreenerCandidatesTableProps {
  candidates: ScreenerCandidate[];
  onCreateOrder: (candidate: ScreenerCandidate) => void;
  onRecommendationDetails: (candidate: ScreenerCandidate) => void;
  onSocialAnalysis: (ticker: string) => void;
  onTradeThesis: (candidate: ScreenerCandidate) => void;
  onQuickBacktest: (candidate: ScreenerCandidate) => void;
}

/**
 * Simplified screener candidates table with 7 essential columns and expandable details
 */
export default function ScreenerCandidatesTable({
  candidates,
  onCreateOrder,
  onRecommendationDetails,
  onSocialAnalysis,
  onTradeThesis,
  onQuickBacktest,
}: ScreenerCandidatesTableProps) {
  // Track expanded rows by ticker
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (ticker: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) {
        next.delete(ticker);
      } else {
        next.add(ticker);
      }
      return next;
    });
  };

  if (candidates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('screener.table.empty')}
      </div>
    );
  }

  return (
    <TableShell
      headers={
        <tr>
          <th className="py-3 px-4 text-sm font-semibold text-gray-700 text-left">
            {t('screener.table.headers.rank')}
          </th>
          <th className="py-3 px-4 text-sm font-semibold text-gray-700 text-left">
            {t('screener.table.headers.symbol')}
          </th>
          <th className="py-3 px-4 text-sm font-semibold text-gray-700 text-left">
            {t('screener.table.headers.lastBar')}
          </th>
          <th className="py-3 px-4 text-sm font-semibold text-gray-700 text-right">
            {t('screener.table.headers.close')}
          </th>
          <th className="py-3 px-4 text-sm font-semibold text-gray-700 text-left">
            {t('screener.table.headers.setup')}
          </th>
          <th className="py-3 px-4 text-sm font-semibold text-gray-700 text-center">
            {t('screener.table.headers.fix')}
          </th>
          <th className="py-3 px-4 text-sm font-semibold text-gray-700 text-center">
            {t('screener.table.headers.actions')}
          </th>
        </tr>
      }
    >
      {candidates.map((candidate) => {
        const vm = toCandidateViewModel(candidate);
        const isExpanded = expandedRows.has(candidate.ticker);

        return (
          <>
            {/* Main row with essential data */}
            <tr
              key={candidate.ticker}
              className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {/* Rank */}
              <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-medium">
                #{candidate.rank}
              </td>

              {/* Symbol (Identity Cell) */}
              <td className="py-3 px-4">
                <ScreenerCandidateIdentityCell candidate={vm} />
              </td>

              {/* Last Bar */}
              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                {candidate.lastBar ? formatDate(candidate.lastBar) : '—'}
              </td>

              {/* Close */}
              <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-gray-100 font-mono">
                {formatCurrency(candidate.close, candidate.currency)}
              </td>

              {/* Setup Cell */}
              <td className="py-3 px-4">
                <ScreenerCandidateSetupCell candidate={vm} />
              </td>

              {/* Fix */}
              <td className="py-3 px-4 text-center">
                {hasFixes(vm) ? (
                  <span
                    className="text-xs text-blue-700 dark:text-blue-400 underline decoration-dotted cursor-help"
                    title={vm.fixes.join(' | ')}
                  >
                    {t('screener.table.fixLabel')}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>

              {/* Actions */}
              <td className="py-3 px-4">
                <div className="flex gap-2 justify-center items-center">
                  {/* Expand/Collapse toggle */}
                  <button
                    type="button"
                    onClick={() => toggleRow(candidate.ticker)}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    aria-label={
                      isExpanded
                        ? t('screener.table.collapseRowAria', { ticker: candidate.ticker })
                        : t('screener.table.expandRowAria', { ticker: candidate.ticker })
                    }
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {/* Recommendation Details */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onRecommendationDetails(candidate)}
                    title={t('screener.table.recommendationDetailsTitle')}
                    aria-label={t('screener.table.recommendationDetailsAria', { ticker: candidate.ticker })}
                  >
                    <ListChecks className="w-4 h-4" />
                  </Button>

                  {/* Create Order */}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onCreateOrder(candidate)}
                    title={
                      vm.verdict === 'NOT_RECOMMENDED'
                        ? t('screener.table.createOrderNotRecommendedTitle')
                        : t('screener.table.createOrderTitle')
                    }
                  >
                    {t('screener.table.createOrderAction')}
                  </Button>
                </div>
              </td>
            </tr>

            {/* Expandable details row */}
            {isExpanded && (
              <ScreenerCandidateDetailsRow
                candidate={vm}
                onSocialClick={() => onSocialAnalysis(candidate.ticker)}
                onThesisClick={() => onTradeThesis(candidate)}
                onBacktestClick={() => onQuickBacktest(candidate)}
              />
            )}
          </>
        );
      })}
    </TableShell>
  );
}
