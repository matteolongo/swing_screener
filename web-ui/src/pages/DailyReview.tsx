import { useEffect, useMemo, useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDailyReview } from '@/features/dailyReview/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import TableShell from '@/components/common/TableShell';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { useConfigStore } from '@/stores/configStore';
import type { RiskConfig } from '@/types/config';
import GlossaryLegend from '@/components/domain/education/GlossaryLegend';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import { DAILY_REVIEW_GLOSSARY_KEYS } from '@/content/educationGlossary';
import RecommendationDetailsModal from '@/components/domain/recommendation/RecommendationDetailsModal';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';
import { queryKeys } from '@/lib/queryKeys';
import { t } from '@/i18n/t';
import {
  useIntelligenceOpportunities,
  useIntelligenceRunStatus,
  useRunIntelligenceMutation,
} from '@/features/intelligence/hooks';
import type {
  DailyReviewCandidate,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
  DailyReviewPositionClose,
} from '@/features/dailyReview/types';

export default function DailyReview() {
  const [expandedSections, setExpandedSections] = useState({
    candidates: true,
    hold: false,
    update: true,
    close: true,
  });
  const [recommendationCandidate, setRecommendationCandidate] = useState<DailyReviewCandidate | null>(null);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<DailyReviewCandidate | null>(null);
  const [intelligenceJobId, setIntelligenceJobId] = useState<string>();
  const [intelligenceAsofDate, setIntelligenceAsofDate] = useState<string>();

  const queryClient = useQueryClient();
  const { data: review, isLoading, error, refetch, isFetching } = useDailyReview(10);
  const config = useConfigStore((state) => state.config);
  const riskConfig: RiskConfig = config?.risk ?? {
    accountSize: 10000,
    riskPct: 0.01,
    minShares: 1,
    maxPositionPct: 0.2,
    kAtr: 2,
    minRr: 2,
    maxFeeRiskPct: 0.05,
  };
  const intelligenceSymbols = useMemo(() => {
    if (!review) return [];
    const candidateSymbols = review.newCandidates.map((candidate) => candidate.ticker);
    const positionSymbols = [
      ...review.positionsHold.map((position) => position.ticker),
      ...review.positionsUpdateStop.map((position) => position.ticker),
      ...review.positionsClose.map((position) => position.ticker),
    ];
    return Array.from(
      new Set([...candidateSymbols, ...positionSymbols].filter((ticker) => ticker && ticker.trim().length > 0))
    );
  }, [review]);
  const runIntelligenceMutation = useRunIntelligenceMutation((launch) => {
    setIntelligenceJobId(launch.jobId);
    setIntelligenceAsofDate(undefined);
  });
  const intelligenceStatusQuery = useIntelligenceRunStatus(intelligenceJobId);
  const intelligenceStatus = intelligenceStatusQuery.data;
  const intelligenceOpportunitiesQuery = useIntelligenceOpportunities(
    intelligenceAsofDate,
    Boolean(intelligenceAsofDate)
  );
  const intelligenceOpportunities = intelligenceOpportunitiesQuery.data?.opportunities ?? [];
  useEffect(() => {
    if (intelligenceStatus?.status === 'completed' && intelligenceStatus.asofDate) {
      setIntelligenceAsofDate(intelligenceStatus.asofDate);
    }
  }, [intelligenceStatus?.asofDate, intelligenceStatus?.status]);
  const handleRunIntelligence = () => {
    if (!intelligenceSymbols.length) {
      return;
    }
    runIntelligenceMutation.mutate({
      symbols: intelligenceSymbols.slice(0, 100),
    });
  };
  const formatScorePercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t('dailyReview.header.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.header.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t('dailyReview.header.title')}</h1>
        <Card>
          <CardContent>
            <p className="text-red-600 dark:text-red-400">
              {t('dailyReview.header.error', {
                message: error instanceof Error ? error.message : t('dailyReview.header.unknownError'),
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const { summary } = review;
  const recommendedCandidates = review.newCandidates.filter(
    (candidate) => candidate.recommendation?.verdict === 'RECOMMENDED',
  );
  const hiddenCandidates = review.newCandidates.length - recommendedCandidates.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{t('dailyReview.header.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {new Date(`${summary.reviewDate}T00:00:00`).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => refetch()}
          disabled={isFetching}
          title={t('dailyReview.header.refreshTitle')}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? t('dailyReview.header.refreshing') : t('dailyReview.header.refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title={t('dailyReview.summary.newCandidates')} value={summary.newCandidates} variant="blue" icon="📈" />
        <SummaryCard
          title={t('dailyReview.summary.updateStop')}
          value={summary.updateStop}
          variant={summary.updateStop > 0 ? 'yellow' : 'gray'}
          icon="🔄"
        />
        <SummaryCard
          title={t('dailyReview.summary.closePositions')}
          value={summary.closePositions}
          variant={summary.closePositions > 0 ? 'red' : 'gray'}
          icon="❌"
        />
        <SummaryCard title={t('dailyReview.summary.holdPositions')} value={summary.noAction} variant="green" icon="✅" />
      </div>

      <Card variant="bordered">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t('dailyReview.intelligence.title')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('dailyReview.intelligence.subtitle')}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('dailyReview.intelligence.symbolsLine', {
                count: intelligenceSymbols.length,
                symbols:
                  intelligenceSymbols.slice(0, 8).join(', ') || t('dailyReview.intelligence.noneSymbol'),
              })}
            </p>
          </div>
          <Button
            onClick={handleRunIntelligence}
            disabled={!intelligenceSymbols.length || runIntelligenceMutation.isPending}
          >
            {runIntelligenceMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {t('dailyReview.intelligence.runningAction')}
              </>
            ) : (
              t('dailyReview.intelligence.runAction')
            )}
          </Button>
        </div>

        {runIntelligenceMutation.isError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {t('dailyReview.intelligence.startError', {
              error:
                runIntelligenceMutation.error instanceof Error
                  ? runIntelligenceMutation.error.message
                  : t('common.errors.generic'),
            })}
          </p>
        )}

        {intelligenceStatus && (
          <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {intelligenceStatus.status === 'completed' &&
                t('dailyReview.intelligence.statusCompleted', {
                  completed: intelligenceStatus.completedSymbols,
                  total: intelligenceStatus.totalSymbols,
                  opportunities: intelligenceStatus.opportunitiesCount,
                })}
              {intelligenceStatus.status === 'queued' &&
                t('dailyReview.intelligence.statusQueued', {
                  total: intelligenceStatus.totalSymbols,
                })}
              {intelligenceStatus.status === 'running' &&
                t('dailyReview.intelligence.statusRunning', {
                  completed: intelligenceStatus.completedSymbols,
                  total: intelligenceStatus.totalSymbols,
                })}
              {intelligenceStatus.status === 'error' &&
                t('dailyReview.intelligence.statusError', {
                  error: intelligenceStatus.error || t('common.errors.generic'),
                })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('dailyReview.intelligence.updatedAt', {
                updatedAt: intelligenceStatus.updatedAt,
              })}
            </p>
          </div>
        )}

        {intelligenceStatusQuery.isError && !intelligenceStatus && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {t('dailyReview.intelligence.statusLoadError')}
          </p>
        )}

        {intelligenceAsofDate && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {t('dailyReview.intelligence.opportunitiesTitle', { date: intelligenceAsofDate })}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => intelligenceOpportunitiesQuery.refetch()}
                disabled={intelligenceOpportunitiesQuery.isFetching}
              >
                {t('dailyReview.intelligence.refreshOpportunities')}
              </Button>
            </div>

            {intelligenceOpportunitiesQuery.isFetching && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dailyReview.intelligence.loading')}</p>
            )}

            {!intelligenceOpportunitiesQuery.isFetching && intelligenceOpportunities.length === 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dailyReview.intelligence.empty')}</p>
            )}

            {intelligenceOpportunities.length > 0 && (
              <div className="space-y-2">
                {intelligenceOpportunities.slice(0, 8).map((opportunity) => (
                  <div
                    key={opportunity.symbol}
                    className="rounded-md border border-gray-200 dark:border-gray-700 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="primary">{opportunity.symbol}</Badge>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t('dailyReview.intelligence.stateValue', { state: opportunity.state })}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                        {t('dailyReview.intelligence.opportunityScore', {
                          value: formatScorePercent(opportunity.opportunityScore),
                        })}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      {t('dailyReview.intelligence.componentsLine', {
                        technical: formatScorePercent(opportunity.technicalReadiness),
                        catalyst: formatScorePercent(opportunity.catalystStrength),
                      })}
                    </p>
                    {opportunity.explanations[0] && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {opportunity.explanations[0]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <CollapsibleSection
        title={t('dailyReview.sections.newTradeCandidates', { count: recommendedCandidates.length })}
        isExpanded={expandedSections.candidates}
        onToggle={() => toggleSection('candidates')}
        count={recommendedCandidates.length}
      >
        {recommendedCandidates.length === 0 ? (
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noRecommended')}</p>
            {hiddenCandidates > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.hiddenByVerdict', {
                  count: hiddenCandidates,
                  suffix: hiddenCandidates === 1 ? '' : 's',
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <GlossaryLegend metricKeys={DAILY_REVIEW_GLOSSARY_KEYS} title={t('dailyReview.sections.dailyGlossary')} />
            {hiddenCandidates > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.showingRecommendedOnly', {
                  count: hiddenCandidates,
                  suffix: hiddenCandidates === 1 ? '' : 's',
                })}
              </p>
            ) : null}
            <CandidatesTable
              candidates={recommendedCandidates}
              onShowRecommendation={setRecommendationCandidate}
              onCreateOrder={(candidate) => {
                setSelectedCandidate(candidate);
                setShowCreateOrderModal(true);
              }}
            />
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('dailyReview.sections.updateStop', { count: review.positionsUpdateStop.length })}
        isExpanded={expandedSections.update}
        onToggle={() => toggleSection('update')}
        count={review.positionsUpdateStop.length}
        variant="warning"
      >
        {review.positionsUpdateStop.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noStopUpdates')}</p>
        ) : (
          <div className="space-y-3">
            <GlossaryLegend metricKeys={DAILY_REVIEW_GLOSSARY_KEYS} title={t('dailyReview.sections.stopGlossary')} />
            <UpdateStopTable positions={review.positionsUpdateStop} />
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('dailyReview.sections.closeSuggested', { count: review.positionsClose.length })}
        isExpanded={expandedSections.close}
        onToggle={() => toggleSection('close')}
        count={review.positionsClose.length}
        variant="danger"
      >
        {review.positionsClose.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noClose')}</p>
        ) : (
          <CloseTable positions={review.positionsClose} />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('dailyReview.sections.noActionNeeded', { count: review.positionsHold.length })}
        isExpanded={expandedSections.hold}
        onToggle={() => toggleSection('hold')}
        count={review.positionsHold.length}
      >
        {review.positionsHold.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noHold')}</p>
        ) : (
          <HoldTable positions={review.positionsHold} />
        )}
      </CollapsibleSection>

      {recommendationCandidate ? (
        <RecommendationDetailsModal
          ticker={recommendationCandidate.ticker}
          recommendation={recommendationCandidate.recommendation}
          onClose={() => setRecommendationCandidate(null)}
        />
      ) : null}

      {showCreateOrderModal && selectedCandidate ? (
        <CandidateOrderModal
          candidate={{
            ticker: selectedCandidate.ticker,
            entry: selectedCandidate.entry,
            stop: selectedCandidate.stop,
            shares: selectedCandidate.shares,
            recommendation: selectedCandidate.recommendation,
            sector: selectedCandidate.sector,
            rReward: selectedCandidate.rReward,
          }}
          risk={riskConfig}
          defaultNotes={t('dailyReview.defaultNotes', {
            entry: formatCurrency(selectedCandidate.entry),
            rr: formatNumber(selectedCandidate.rReward, 1),
          })}
          onClose={() => {
            setShowCreateOrderModal(false);
            setSelectedCandidate(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
            setShowCreateOrderModal(false);
            setSelectedCandidate(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  variant,
  icon,
}: {
  title: string;
  value: number;
  variant: 'blue' | 'yellow' | 'red' | 'green' | 'gray';
  icon: string;
}) {
  const variantClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    gray: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
  };

  return (
    <Card className={variantClasses[variant]}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <span className="text-4xl">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  count,
  variant,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  count: number;
  variant?: 'warning' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>{title}</CardTitle>
            {count > 0 && variant === 'warning' ? (
              <Badge variant="warning">
                {t('dailyReview.sections.actionsBadge', { count, suffix: count !== 1 ? 's' : '' })}
              </Badge>
            ) : null}
            {count > 0 && variant === 'danger' ? (
              <Badge variant="error">
                {t('dailyReview.sections.actionsBadge', { count, suffix: count !== 1 ? 's' : '' })}
              </Badge>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            title={isExpanded ? t('dailyReview.sections.collapse') : t('dailyReview.sections.expand')}
          >
            {isExpanded ? '▼' : '▶'}
          </Button>
        </div>
      </CardHeader>
      {isExpanded ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

function CandidatesTable({
  candidates,
  onShowRecommendation,
  onCreateOrder,
}: {
  candidates: DailyReviewCandidate[];
  onShowRecommendation: (candidate: DailyReviewCandidate) => void;
  onCreateOrder: (candidate: DailyReviewCandidate) => void;
}) {
  return (
    <TableShell
      empty={candidates.length === 0}
      emptyMessage={t('dailyReview.table.candidates.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.ticker')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="CONFIDENCE" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.signal')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.stop')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.shares')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="RR" labelOverride="R:R" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.sector')}</th>
          <th className="text-center p-2">{t('dailyReview.table.candidates.headers.info')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.action')}</th>
        </tr>
      )}
    >
      {candidates.map((candidate) => (
        <tr key={candidate.ticker} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 font-mono font-bold">{candidate.ticker}</td>
          <td className="p-2 text-right">
            <span className="font-semibold text-purple-600">
              {candidate.confidence != null ? formatNumber(candidate.confidence, 1) : '-'}
            </span>
          </td>
          <td className="p-2">
            <Badge variant="primary">{candidate.signal}</Badge>
          </td>
          <td className="p-2 text-right">{formatCurrency(candidate.entry)}</td>
          <td className="p-2 text-right">{formatCurrency(candidate.stop)}</td>
          <td className="p-2 text-right">{candidate.shares}</td>
          <td className="p-2 text-right font-bold">
            {t('common.units.rValue', { value: formatNumber(candidate.rReward, 1) })}
          </td>
          <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
            {candidate.sector || t('common.placeholders.dash')}
          </td>
          <td className="p-2 text-center">
            {candidate.recommendation ? (
              <button
                onClick={() => onShowRecommendation(candidate)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title={t('dailyReview.table.candidates.recommendationTitle')}
                aria-label={t('dailyReview.table.candidates.recommendationAria', { ticker: candidate.ticker })}
              >
                <Info className="w-4 h-4" />
              </button>
            ) : null}
          </td>
          <td className="p-2 text-right">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onCreateOrder(candidate)}
              title={
                candidate.recommendation?.verdict === 'NOT_RECOMMENDED'
                  ? t('dailyReview.table.candidates.createOrderNotRecommendedTitle')
                  : t('dailyReview.table.candidates.createOrderTitle')
              }
            >
              {t('dailyReview.table.candidates.createOrder')}
            </Button>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

const TIME_EXIT_REASON_PATTERN = /Time exit:\s*(\d+)\s*bars since entry_date\s*>=\s*(\d+)/i;

function formatDailyReviewReason(reason: string): string {
  const timeExitMatch = reason.match(TIME_EXIT_REASON_PATTERN);
  if (timeExitMatch) {
    return t('dailyReview.reason.timeExit', {
      barsSince: Number(timeExitMatch[1]),
      maxBars: Number(timeExitMatch[2]),
    });
  }
  return reason;
}

function UpdateStopTable({ positions }: { positions: DailyReviewPositionUpdate[] }) {
  return (
    <TableShell
      empty={positions.length === 0}
      emptyMessage={t('dailyReview.table.update.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.update.headers.ticker')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.current')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.stopOld')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.stopNew')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.update.headers.reason')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.action')}</th>
        </tr>
      )}
    >
      {positions.map((pos) => (
        <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 font-mono font-bold">{pos.ticker}</td>
          <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
          <td className="p-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(pos.stopCurrent)}</td>
          <td className="p-2 text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(pos.stopSuggested)}</td>
          <td className="p-2 text-right">
            <span className={pos.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
            </span>
          </td>
          <td className="p-2 text-sm">{formatDailyReviewReason(pos.reason)}</td>
          <td className="p-2 text-right">
            <Button
              variant="secondary"
              size="sm"
              disabled
              title={t('dailyReview.table.update.actionDisabledTitle')}
            >
              {t('dailyReview.table.update.actionLabel')}
            </Button>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function CloseTable({ positions }: { positions: DailyReviewPositionClose[] }) {
  return (
    <TableShell
      empty={positions.length === 0}
      emptyMessage={t('dailyReview.table.close.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.close.headers.ticker')}</th>
          <th className="text-right p-2">{t('dailyReview.table.close.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.close.headers.current')}</th>
          <th className="text-right p-2">{t('dailyReview.table.close.headers.stop')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.close.headers.reason')}</th>
          <th className="text-right p-2">{t('dailyReview.table.close.headers.action')}</th>
        </tr>
      )}
    >
      {positions.map((pos) => (
        <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 font-mono font-bold">{pos.ticker}</td>
          <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.stopPrice)}</td>
          <td className="p-2 text-right">
            <span className="text-red-600 dark:text-red-400 font-bold">
              {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
            </span>
          </td>
          <td className="p-2 text-sm">{formatDailyReviewReason(pos.reason)}</td>
          <td className="p-2 text-right">
            <Button
              variant="danger"
              size="sm"
              disabled
              title={t('dailyReview.table.close.actionDisabledTitle')}
            >
              {t('dailyReview.table.close.actionLabel')}
            </Button>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function HoldTable({ positions }: { positions: DailyReviewPositionHold[] }) {
  return (
    <TableShell
      empty={positions.length === 0}
      emptyMessage={t('dailyReview.table.hold.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.hold.headers.ticker')}</th>
          <th className="text-right p-2">{t('dailyReview.table.hold.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.hold.headers.current')}</th>
          <th className="text-right p-2">{t('dailyReview.table.hold.headers.stop')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.hold.headers.reason')}</th>
        </tr>
      )}
    >
      {positions.map((pos) => (
        <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 font-mono font-bold">{pos.ticker}</td>
          <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.stopPrice)}</td>
          <td className="p-2 text-right">
            <span className={pos.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
            </span>
          </td>
          <td className="p-2 text-sm text-gray-600 dark:text-gray-400">{formatDailyReviewReason(pos.reason)}</td>
        </tr>
      ))}
    </TableShell>
  );
}
