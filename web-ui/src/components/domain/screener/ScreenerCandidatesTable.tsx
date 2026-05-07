import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import Button from '@/components/common/Button';
import TableShell from '@/components/common/TableShell';
import { ScreenerCandidate } from '@/features/screener/types';
import { toCandidateViewModel } from '@/features/screener/viewModel';
import { useScreenerRecurrence } from '@/features/screener/recurrenceHooks';
import { useScreenerStore } from '@/stores/screenerStore';
import ScreenerCandidateIdentityCell from './ScreenerCandidateIdentityCell';
import ScreenerCandidateDetailsRow from './ScreenerCandidateDetailsRow';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

function signalBadge(action?: string): { label: string; className: string } | null {
  switch (action) {
    case 'BUY_NOW':
      return { label: 'Buy Now', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' };
    case 'BUY_ON_PULLBACK':
      return { label: 'Pullback', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' };
    case 'WAIT_FOR_BREAKOUT':
      return { label: 'Breakout', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200' };
    case 'WATCH':
      return { label: 'Watch', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' };
    case 'TACTICAL_ONLY':
      return { label: 'Tactical', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' };
    case 'AVOID':
      return { label: 'Avoid', className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' };
    case 'MANAGE_ONLY':
      return { label: 'Manage', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
    default:
      return null;
  }
}

interface ScreenerCandidatesTableProps {
  candidates: ScreenerCandidate[];
  onCreateOrder: (candidate: ScreenerCandidate) => void;
  onRecommendationDetails: (candidate: ScreenerCandidate) => void;
  onSymbolClick?: (ticker: string) => void;
  selectedTicker?: string | null;
  onRowClick?: (candidate: ScreenerCandidate) => void;
}

/**
 * Simplified screener candidates table: Rank | Symbol | Signal | Close | R:R | Actions
 */
export default function ScreenerCandidatesTable({
  candidates,
  onCreateOrder,
  onRecommendationDetails,
  onSymbolClick,
  selectedTicker,
  onRowClick,
}: ScreenerCandidatesTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const recurrenceQuery = useScreenerRecurrence();
  const benchmarkTicker = useScreenerStore((state) => state.lastResult?.benchmarkTicker ?? 'Benchmark');
  const recurrenceByTicker = new Map<string, number>(
    (recurrenceQuery.data ?? []).map((r) => [r.ticker, r.streak])
  );

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

  const orderActionLabel = (candidate: ScreenerCandidate) =>
    candidate.sameSymbol?.mode === 'ADD_ON' || candidate.sameSymbol?.mode === 'MANAGE_ONLY'
      ? t('screener.table.addOnAction')
      : t('screener.table.createOrderAction');

  const orderActionTitle = (candidate: ScreenerCandidate, verdict: string) => {
    if (verdict === 'NOT_RECOMMENDED') {
      return t('screener.table.createOrderNotRecommendedTitle');
    }
    return candidate.sameSymbol?.mode === 'ADD_ON' || candidate.sameSymbol?.mode === 'MANAGE_ONLY'
      ? t('screener.table.addOnTitle')
      : t('screener.table.createOrderTitle');
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
          <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-left">
            {t('screener.table.headers.priority')}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-left">
            {t('screener.table.headers.symbol')}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-left">
            Signal
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-right">
            {t('screener.table.headers.close')}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-right">
            {`6M vs ${benchmarkTicker}`}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-right">
            R:R
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-gray-700 text-center">
            {t('screener.table.headers.actions')}
          </th>
        </tr>
      }
    >
      {candidates.map((candidate) => {
        const vm = toCandidateViewModel(candidate);
        const isExpanded = expandedRows.has(candidate.ticker);
        const isSelected = selectedTicker != null && selectedTicker.toUpperCase() === candidate.ticker.toUpperCase();
        const badge = signalBadge(candidate.decisionSummary?.action);

        return (
          <React.Fragment key={candidate.ticker}>
            <tr
              onClick={onRowClick ? () => onRowClick(candidate) : undefined}
              className={`border-b border-gray-100 dark:border-gray-700 ${
                isSelected
                  ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              } ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {/* Rank */}
              <td className="py-1.5 px-3 text-xs text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                #{vm.priorityRank}
              </td>

              {/* Symbol */}
              <td className="py-1.5 px-3">
                <ScreenerCandidateIdentityCell
                  candidate={vm}
                  onSymbolClick={onSymbolClick}
                  streak={recurrenceByTicker.get(candidate.ticker.toUpperCase())}
                />
              </td>

              {/* Signal */}
              <td className="py-1.5 px-3">
                <div className="flex items-center gap-1">
                  {badge ? (
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${badge.className}`}>
                      {badge.label}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                  {vm.volumeRatio != null && vm.volumeRatio >= 1.5 && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
                      title={t('screener.details.volumeRatio.dotStrongTitle')}
                      aria-label={t('screener.details.volumeRatio.dotStrongTitle')}
                    />
                  )}
                  {vm.volumeRatio != null && vm.volumeRatio < 0.9 && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                      title={t('screener.details.volumeRatio.dotWeakTitle')}
                      aria-label={t('screener.details.volumeRatio.dotWeakTitle')}
                    />
                  )}
                </div>
              </td>

              {/* Close */}
              <td className="py-1.5 px-3 text-xs text-right text-gray-900 dark:text-gray-100 font-mono whitespace-nowrap">
                {formatCurrency(candidate.close, candidate.currency)}
              </td>

              {/* Benchmark */}
              <td className="py-1.5 px-3 text-xs text-right font-mono whitespace-nowrap">
                {candidate.benchmarkOutperformancePct != null ? (
                  <span className={candidate.benchmarkOutperformancePct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {formatPercent(candidate.benchmarkOutperformancePct, 1)}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>

              {/* R:R */}
              <td className="py-1.5 px-3 text-xs text-right font-mono whitespace-nowrap">
                {vm.rr != null && vm.rr > 0 ? (
                  <span className="text-gray-900 dark:text-gray-100">{vm.rr.toFixed(1)}</span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>

              {/* Actions */}
              <td className="py-1.5 px-3">
                <div className="flex gap-1.5 justify-center items-center">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleRow(candidate.ticker);
                    }}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    aria-label={
                      isExpanded
                        ? t('screener.table.collapseRowAria', { ticker: candidate.ticker })
                        : t('screener.table.expandRowAria', { ticker: candidate.ticker })
                    }
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRecommendationDetails(candidate);
                    }}
                    title={t('screener.table.recommendationDetailsTitle')}
                    aria-label={t('screener.table.recommendationDetailsAria', { ticker: candidate.ticker })}
                  >
                    <ListChecks className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCreateOrder(candidate);
                    }}
                    title={orderActionTitle(candidate, vm.verdict)}
                  >
                    {orderActionLabel(candidate)}
                  </Button>
                </div>
              </td>
            </tr>

            {isExpanded && (
              <ScreenerCandidateDetailsRow candidate={vm} />
            )}
          </React.Fragment>
        );
      })}
    </TableShell>
  );
}
