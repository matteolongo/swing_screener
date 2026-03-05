import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, ListChecks } from 'lucide-react';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import TableShell from '@/components/common/TableShell';
import { ScreenerCandidate } from '@/features/screener/types';
import { toCandidateViewModel } from '@/features/screener/viewModel';
import ScreenerCandidateIdentityCell from './ScreenerCandidateIdentityCell';
import ScreenerCandidateSetupCell from './ScreenerCandidateSetupCell';
import ScreenerCandidateDetailsRow from './ScreenerCandidateDetailsRow';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { t } from '@/i18n/t';

const MOBILE_LAYOUT_MEDIA_QUERY = '(max-width: 767px)';

function getMobileLayoutMatch() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches;
}

interface ScreenerCandidatesTableProps {
  candidates: ScreenerCandidate[];
  onCreateOrder: (candidate: ScreenerCandidate) => void;
  onRecommendationDetails: (candidate: ScreenerCandidate) => void;
  onSocialAnalysis: (ticker: string) => void;
  onWhyMatched: (candidate: ScreenerCandidate) => void;
  onSymbolClick?: (ticker: string) => void;
  selectedTicker?: string | null;
  onRowClick?: (candidate: ScreenerCandidate) => void;
}

/**
 * Simplified screener candidates table with essential columns and expandable details
 */
export default function ScreenerCandidatesTable({
  candidates,
  onCreateOrder,
  onRecommendationDetails,
  onSocialAnalysis,
  onWhyMatched,
  onSymbolClick,
  selectedTicker,
  onRowClick,
}: ScreenerCandidatesTableProps) {
  // Track expanded rows by ticker
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isCompactMobileLayout, setIsCompactMobileLayout] = useState(getMobileLayoutMatch);

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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactMobileLayout(event.matches);
    };

    setIsCompactMobileLayout(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  if (candidates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {t('screener.table.empty')}
      </div>
    );
  }

  if (isCompactMobileLayout) {
    return (
      <div className="space-y-3 p-2">
        {candidates.map((candidate) => {
          const vm = toCandidateViewModel(candidate);
          const isExpanded = expandedRows.has(candidate.ticker);
          const isSelected = selectedTicker != null && selectedTicker.toUpperCase() === candidate.ticker.toUpperCase();

          return (
            <div
              key={candidate.ticker}
              onClick={onRowClick ? () => onRowClick(candidate) : undefined}
              className={`rounded-xl border p-3 ${
                isSelected
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              } ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">#{candidate.rank}</p>
                  {onSymbolClick ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSymbolClick(candidate.ticker);
                      }}
                      className="font-mono text-base font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                      title={t('workspacePage.symbolDetails.openTitle', { ticker: candidate.ticker })}
                    >
                      {candidate.ticker}
                    </button>
                  ) : (
                    <p className="font-mono text-base font-semibold text-gray-900 dark:text-gray-100">
                      {candidate.ticker}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {candidate.lastBar ? formatDate(candidate.lastBar) : '—'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(candidate.close, candidate.currency)}
                  </p>
                  <Badge variant={vm.verdict === 'RECOMMENDED' ? 'success' : 'warning'} className="mt-1">
                    {vm.verdict === 'RECOMMENDED' ? t('recommendation.verdict.recommended') : t('recommendation.verdict.notRecommended')}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40">
                <ScreenerCandidateSetupCell candidate={vm} />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRecommendationDetails(candidate);
                  }}
                  title={t('screener.table.recommendationDetailsTitle')}
                  aria-label={t('screener.table.recommendationDetailsAria', { ticker: candidate.ticker })}
                >
                  <ListChecks className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-1"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreateOrder(candidate);
                  }}
                  title={
                    vm.verdict === 'NOT_RECOMMENDED'
                      ? t('screener.table.createOrderNotRecommendedTitle')
                      : t('screener.table.createOrderTitle')
                  }
                >
                  {t('screener.table.createOrderAction')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleRow(candidate.ticker);
                  }}
                  aria-label={
                    isExpanded
                      ? t('screener.table.collapseRowAria', { ticker: candidate.ticker })
                      : t('screener.table.expandRowAria', { ticker: candidate.ticker })
                  }
                  title={
                    isExpanded
                      ? t('screener.table.collapseRowAria', { ticker: candidate.ticker })
                      : t('screener.table.expandRowAria', { ticker: candidate.ticker })
                  }
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>

              {isExpanded ? (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSocialAnalysis(candidate.ticker);
                    }}
                    title={t('screener.table.sentimentTitle')}
                    aria-label={t('screener.table.sentimentAria', { ticker: candidate.ticker })}
                  >
                    {t('screener.table.sentimentTitle')}
                  </Button>
                  {candidate.recommendation ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        onWhyMatched(candidate);
                      }}
                      title={t('screener.table.whyMatchedTitle')}
                      aria-label={t('screener.table.whyMatchedAria', { ticker: candidate.ticker })}
                    >
                      {t('screener.table.whyMatchedAction')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
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
            {t('screener.table.headers.actions')}
          </th>
        </tr>
      }
    >
      {candidates.map((candidate) => {
        const vm = toCandidateViewModel(candidate);
        const isExpanded = expandedRows.has(candidate.ticker);
        const isSelected = selectedTicker != null && selectedTicker.toUpperCase() === candidate.ticker.toUpperCase();

        return (
          <React.Fragment key={candidate.ticker}>
            {/* Main row with essential data */}
            <tr
              onClick={onRowClick ? () => onRowClick(candidate) : undefined}
              className={`border-b border-gray-100 dark:border-gray-700 ${
                isSelected
                  ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              } ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {/* Rank */}
              <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100 font-medium">
                #{candidate.rank}
              </td>

              {/* Symbol (Identity Cell) */}
              <td className="py-3 px-4">
                <ScreenerCandidateIdentityCell candidate={vm} onSymbolClick={onSymbolClick} />
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

              {/* Actions */}
              <td className="py-3 px-4">
                <div className="flex gap-2 justify-center items-center">
                  {/* Expand/Collapse toggle */}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleRow(candidate.ticker);
                    }}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      onRecommendationDetails(candidate);
                    }}
                    title={t('screener.table.recommendationDetailsTitle')}
                    aria-label={t('screener.table.recommendationDetailsAria', { ticker: candidate.ticker })}
                  >
                    <ListChecks className="w-4 h-4" />
                  </Button>

                  {candidate.recommendation ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        onWhyMatched(candidate);
                      }}
                      title={t('screener.table.whyMatchedTitle')}
                      aria-label={t('screener.table.whyMatchedAria', { ticker: candidate.ticker })}
                    >
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  ) : null}

                  {/* Create Order */}
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCreateOrder(candidate);
                    }}
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
                onWhyMatchedClick={() => onWhyMatched(candidate)}
              />
            )}
          </React.Fragment>
        );
      })}
    </TableShell>
  );
}
