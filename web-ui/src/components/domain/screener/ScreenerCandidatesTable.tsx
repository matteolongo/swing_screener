import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Button from '@/components/common/Button';
import TableShell from '@/components/common/TableShell';
import WatchToggleButton from '@/components/domain/watchlist/WatchToggleButton';
import type { ScreenerCandidate } from '@/features/screener/types';
import { toCandidateViewModel } from '@/features/screener/viewModel';
import { useScreenerRecurrence } from '@/features/screener/recurrenceHooks';
import { useUnwatchSymbolMutation, useWatchlist, useWatchSymbolMutation } from '@/features/watchlist/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import ScreenerCandidateIdentityCell from './ScreenerCandidateIdentityCell';
import ScreenerCandidateDetailsRow from './ScreenerCandidateDetailsRow';
import { formatCurrency, formatPercent, getSignColorClass } from '@/utils/formatters';
import { t } from '@/i18n/t';
import { canReviewPendingPullbackOrder, formatWorkflowNextStep, groupCandidatesByWorkflow } from '@/components/domain/recommendation/workflowPresentation';
import ScreenerWorkflowGroup from './ScreenerWorkflowGroup';

interface ScreenerCandidatesTableProps {
  candidates: ScreenerCandidate[];
  onCreateOrder: (candidate: ScreenerCandidate) => void;
  onRecommendationDetails: (candidate: ScreenerCandidate) => void;
  onSymbolClick?: (ticker: string) => void;
  selectedTicker?: string | null;
  onRowClick?: (candidate: ScreenerCandidate) => void;
}

/**
 * Screener candidates grouped by their next beginner-facing workflow action.
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
  const watchlistQuery = useWatchlist();
  const watchSymbolMutation = useWatchSymbolMutation();
  const unwatchSymbolMutation = useUnwatchSymbolMutation();
  const benchmarkTicker = useScreenerStore((state) => state.lastResult?.benchmarkTicker ?? 'Benchmark');
  const recurrenceByTicker = new Map<string, number>(
    (recurrenceQuery.data ?? []).map((r) => [r.ticker, r.streak])
  );
  const watchedTickers = new Set((watchlistQuery.data ?? []).map((item) => item.ticker.toUpperCase()));
  const groups = groupCandidatesByWorkflow(candidates);

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

  const handleWatch = (candidate: ScreenerCandidate) => {
    watchSymbolMutation.mutate({
      ticker: candidate.ticker,
      watchPrice: candidate.close,
      currency: candidate.currency,
      source: 'screener',
    });
  };

  const handleUnwatch = (ticker: string) => {
    unwatchSymbolMutation.mutate(ticker);
  };

  return (
    <div className="space-y-3">
      {groups.map(({ status, presentation, candidates: groupCandidates }) => (
        <ScreenerWorkflowGroup key={status} presentation={presentation} count={groupCandidates.length} defaultOpen={status !== 'no_setup'}>
          <TableShell headers={<tr>
          <th className="py-2 px-3 text-xs font-semibold text-muted text-left">
            {t('screener.table.headers.priority')}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-muted text-left">
            {t('screener.table.headers.symbol')}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-muted text-left">
            {t('screener.table.headers.nextAction')}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-muted text-right">
            {t('screener.table.headers.close')}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-muted text-right">
            {t('screener.table.headers.relativeSixMonth', { benchmark: benchmarkTicker })}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-muted text-right">
            {t('screener.table.headers.rr')}
          </th>
          <th className="py-2 px-3 text-xs font-semibold text-muted text-center">
            {t('screener.table.headers.actions')}
          </th>
          </tr>}>
      {groupCandidates.map((candidate) => {
        const vm = toCandidateViewModel(candidate);
        const isExpanded = expandedRows.has(candidate.ticker);
        const isSelected = selectedTicker != null && selectedTicker.toUpperCase() === candidate.ticker.toUpperCase();
        const workflowStatus = candidate.recommendation?.workflowStatus ?? 'needs_review';
        const canReviewOrder = workflowStatus === 'ready' || canReviewPendingPullbackOrder(candidate);
        const isWatched = watchedTickers.has(candidate.ticker.toUpperCase());
        const isWatchPending =
          (watchSymbolMutation.isPending &&
            watchSymbolMutation.variables?.ticker?.toUpperCase() === candidate.ticker.toUpperCase()) ||
          (unwatchSymbolMutation.isPending &&
            unwatchSymbolMutation.variables?.toUpperCase() === candidate.ticker.toUpperCase());

        return (
          <React.Fragment key={candidate.ticker}>
            <tr
              onClick={onRowClick ? () => onRowClick(candidate) : undefined}
              onKeyDown={onRowClick ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRowClick(candidate);
                }
              } : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick ? t('screener.table.selectRow', { ticker: candidate.ticker }) : undefined}
              className={`border-b border-border ${
                isSelected
                  ? 'bg-primary/10 hover:bg-primary/10'
                  : 'hover:bg-foreground/5'
              } ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {/* Rank */}
              <td className="py-1.5 px-3 text-xs text-foreground font-medium whitespace-nowrap">
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

              {/* Next action */}
              <td className="py-1.5 px-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-foreground">{formatWorkflowNextStep(candidate.recommendation?.nextStep)}</span>
                  {candidate.signal === 'pullback' || candidate.signal === 'breakout' ? (
                    <span className="text-[10px] text-muted">
                      {candidate.signal === 'pullback'
                        ? t('screener.table.setupType.pullback')
                        : t('screener.table.setupType.breakout')}
                    </span>
                  ) : null}
                  {vm.volumeRatio != null && vm.volumeRatio >= 1.5 && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-success flex-shrink-0"
                      title={t('screener.details.volumeRatio.dotStrongTitle')}
                      aria-label={t('screener.details.volumeRatio.dotStrongTitle')}
                    />
                  )}
                  {vm.volumeRatio != null && vm.volumeRatio < 0.9 && (
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-warning flex-shrink-0"
                      title={t('screener.details.volumeRatio.dotWeakTitle')}
                      aria-label={t('screener.details.volumeRatio.dotWeakTitle')}
                    />
                  )}
                </div>
              </td>

              {/* Close */}
              <td className="py-1.5 px-3 text-xs text-right text-foreground font-mono whitespace-nowrap">
                {formatCurrency(candidate.close, candidate.currency)}
              </td>

              {/* Benchmark */}
              <td className="py-1.5 px-3 text-xs text-right font-mono whitespace-nowrap">
                {candidate.benchmarkOutperformancePct != null ? (
                  <span className={getSignColorClass(candidate.benchmarkOutperformancePct)}>
                    {formatPercent(candidate.benchmarkOutperformancePct, 1)}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>

              {/* R:R */}
              <td className="py-1.5 px-3 text-xs text-right font-mono whitespace-nowrap">
                {vm.rr != null && vm.rr > 0 ? (
                  <span className="text-foreground">{vm.rr.toFixed(1)}</span>
                ) : (
                  <span className="text-muted">—</span>
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
                    className="p-1 rounded hover:bg-foreground/5"
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

                  {canReviewOrder ? (
                    <Button size="sm" variant="primary" onClick={(event) => {
                      event.stopPropagation();
                      onCreateOrder(candidate);
                    }}>
                      {t('screener.table.reviewOrderAction')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={(event) => {
                      event.stopPropagation();
                      onRecommendationDetails(candidate);
                    }}>
                      {workflowStatus === 'waiting_trigger'
                        ? t('screener.table.openDetailsAction')
                        : workflowStatus === 'needs_review'
                          ? t('screener.table.openVerificationAction')
                          : t('screener.table.viewContextAction')}
                    </Button>
                  )}

                  <WatchToggleButton
                    ticker={candidate.ticker}
                    isWatched={isWatched}
                    isPending={isWatchPending}
                    onWatch={() => handleWatch(candidate)}
                    onUnwatch={handleUnwatch}
                  />
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
        </ScreenerWorkflowGroup>
      ))}
    </div>
  );
}
