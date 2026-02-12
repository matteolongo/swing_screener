import { useEffect, useState } from 'react';
import { Info, RefreshCw, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDailyReview } from '@/features/dailyReview/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { formatCurrency, formatNumber, formatRatioAsPercent } from '@/utils/formatters';
import { CreateOrderRequest } from '@/features/portfolio/types';
import { createOrder } from '@/features/portfolio/api';
import { useConfigStore } from '@/stores/configStore';
import { RiskConfig } from '@/types/config';
import GlossaryLegend from '@/components/domain/education/GlossaryLegend';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import { DAILY_REVIEW_GLOSSARY_KEYS } from '@/content/educationGlossary';
import type {
  DailyReviewCandidate,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
  DailyReviewPositionClose,
} from '@/types/dailyReview';

const VERDICT_BADGES: Record<string, { label: string; className: string }> = {
  RECOMMENDED: { label: 'Recommended', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  NOT_RECOMMENDED: { label: 'Not Recommended', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  UNKNOWN: { label: 'No Verdict', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

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

  const queryClient = useQueryClient();
  const { data: review, isLoading, error, refetch, isFetching } = useDailyReview(10);
  const config = useConfigStore(state => state.config);
  const riskConfig = config?.risk ?? {
    accountSize: 10000,
    riskPct: 0.01,
    minShares: 1,
    maxPositionPct: 0.2,
    kAtr: 2,
    minRr: 2,
    maxFeeRiskPct: 0.05,
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Daily Review</h1>
        <p className="text-gray-600 dark:text-gray-400">Loading daily review...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Daily Review</h1>
        <Card>
          <CardContent>
            <p className="text-red-600 dark:text-red-400">
              Error loading daily review: {error instanceof Error ? error.message : 'Unknown error'}
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
    (candidate) => candidate.recommendation?.verdict === 'RECOMMENDED'
  );
  const hiddenCandidates = review.newCandidates.length - recommendedCandidates.length;

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Daily Review</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {new Date(summary.reviewDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          disabled={isFetching}
          title="Refresh daily review data"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="New Candidates"
          value={summary.newCandidates}
          variant="blue"
          icon="📈"
        />
        <SummaryCard
          title="Update Stop"
          value={summary.updateStop}
          variant={summary.updateStop > 0 ? 'yellow' : 'gray'}
          icon="🔄"
        />
        <SummaryCard
          title="Close Positions"
          value={summary.closePositions}
          variant={summary.closePositions > 0 ? 'red' : 'gray'}
          icon="❌"
        />
        <SummaryCard
          title="Hold Positions"
          value={summary.noAction}
          variant="green"
          icon="✅"
        />
      </div>

      {/* New Candidates Section */}
      <CollapsibleSection
        title={`📈 New Trade Candidates (${recommendedCandidates.length})`}
        isExpanded={expandedSections.candidates}
        onToggle={() => toggleSection('candidates')}
        count={recommendedCandidates.length}
      >
        {recommendedCandidates.length === 0 ? (
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400">No recommended candidates today.</p>
            {hiddenCandidates > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hiddenCandidates} candidate{hiddenCandidates === 1 ? '' : 's'} hidden because verdict is Not Recommended.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <GlossaryLegend metricKeys={DAILY_REVIEW_GLOSSARY_KEYS} title="Daily Review Glossary" />
            {hiddenCandidates > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing recommended setups only. {hiddenCandidates} candidate{hiddenCandidates === 1 ? '' : 's'} hidden.
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

      {/* Positions - Update Stop */}
      <CollapsibleSection
        title={`🔄 Positions - Update Stop (${review.positionsUpdateStop.length})`}
        isExpanded={expandedSections.update}
        onToggle={() => toggleSection('update')}
        count={review.positionsUpdateStop.length}
        variant="warning"
      >
        {review.positionsUpdateStop.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No stop updates needed.</p>
        ) : (
          <div className="space-y-3">
            <GlossaryLegend metricKeys={DAILY_REVIEW_GLOSSARY_KEYS} title="Stop Management Glossary" />
            <UpdateStopTable positions={review.positionsUpdateStop} />
          </div>
        )}
      </CollapsibleSection>

      {/* Positions - Close */}
      <CollapsibleSection
        title={`❌ Positions - Close Suggested (${review.positionsClose.length})`}
        isExpanded={expandedSections.close}
        onToggle={() => toggleSection('close')}
        count={review.positionsClose.length}
        variant="danger"
      >
        {review.positionsClose.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No positions to close.</p>
        ) : (
          <CloseTable positions={review.positionsClose} />
        )}
      </CollapsibleSection>

      {/* Positions - Hold */}
      <CollapsibleSection
        title={`✅ Positions - No Action Needed (${review.positionsHold.length})`}
        isExpanded={expandedSections.hold}
        onToggle={() => toggleSection('hold')}
        count={review.positionsHold.length}
      >
        {review.positionsHold.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No positions to hold.</p>
        ) : (
          <HoldTable positions={review.positionsHold} />
        )}
      </CollapsibleSection>

      {/* Recommendation Modal */}
      {recommendationCandidate && (
        <RecommendationModal
          candidate={recommendationCandidate}
          onClose={() => setRecommendationCandidate(null)}
        />
      )}

      {/* Create Order Modal */}
      {showCreateOrderModal && selectedCandidate && (
        <CreateOrderModal
          candidate={selectedCandidate}
          risk={riskConfig}
          onClose={() => {
            setShowCreateOrderModal(false);
            setSelectedCandidate(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            setShowCreateOrderModal(false);
            setSelectedCandidate(null);
          }}
        />
      )}
    </div>
  );
}

// Summary Card Component
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

// Collapsible Section Component
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
            {count > 0 && variant === 'warning' && (
              <Badge variant="warning">{count} action{count !== 1 ? 's' : ''}</Badge>
            )}
            {count > 0 && variant === 'danger' && (
              <Badge variant="error">{count} action{count !== 1 ? 's' : ''}</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            {isExpanded ? '▼' : '▶'}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && <CardContent>{children}</CardContent>}
    </Card>
  );
}

// Candidates Table
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b dark:border-gray-700">
          <tr>
            <th className="text-left p-2">Ticker</th>
            <th className="text-right p-2">
              <MetricHelpLabel metricKey="CONFIDENCE" className="justify-end w-full" />
            </th>
            <th className="text-left p-2">Signal</th>
            <th className="text-right p-2">Entry</th>
            <th className="text-right p-2">Stop</th>
            <th className="text-right p-2">Shares</th>
            <th className="text-right p-2">
              <MetricHelpLabel metricKey="RR" labelOverride="R:R" className="justify-end w-full" />
            </th>
            <th className="text-left p-2">Sector</th>
            <th className="text-center p-2">Info</th>
            <th className="text-right p-2">Action</th>
          </tr>
        </thead>
        <tbody>
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
              <td className="p-2 text-right font-bold">{formatNumber(candidate.rReward, 1)}R</td>
              <td className="p-2 text-sm text-gray-600 dark:text-gray-400">{candidate.sector || '-'}</td>
              <td className="p-2 text-center">
                {candidate.recommendation && (
                  <button
                    onClick={() => onShowRecommendation(candidate)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    title="Recommendation details"
                    aria-label={`Recommendation details for ${candidate.ticker}`}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                )}
              </td>
              <td className="p-2 text-right">
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => onCreateOrder(candidate)}
                  title={
                    candidate.recommendation?.verdict === 'NOT_RECOMMENDED'
                      ? 'Not recommended — open details to fix'
                      : 'Create Order'
                  }
                >
                  Create Order
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Update Stop Table
function UpdateStopTable({ positions }: { positions: DailyReviewPositionUpdate[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b dark:border-gray-700">
          <tr>
            <th className="text-left p-2">Ticker</th>
            <th className="text-right p-2">Entry</th>
            <th className="text-right p-2">Current</th>
            <th className="text-right p-2">Stop (Old)</th>
            <th className="text-right p-2">Stop (New)</th>
            <th className="text-right p-2">
              <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
            </th>
            <th className="text-left p-2">Reason</th>
            <th className="text-right p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="p-2 font-mono font-bold">{pos.ticker}</td>
              <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
              <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
              <td className="p-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(pos.stopCurrent)}</td>
              <td className="p-2 text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(pos.stopSuggested)}</td>
              <td className="p-2 text-right">
                <span className={pos.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {formatNumber(pos.rNow, 2)}R
                </span>
              </td>
              <td className="p-2 text-sm">{pos.reason}</td>
              <td className="p-2 text-right">
                <Button variant="secondary" size="sm" disabled title="Update stop action not yet available">
                  Update Stop
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Close Table
function CloseTable({ positions }: { positions: DailyReviewPositionClose[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b dark:border-gray-700">
          <tr>
            <th className="text-left p-2">Ticker</th>
            <th className="text-right p-2">Entry</th>
            <th className="text-right p-2">Current</th>
            <th className="text-right p-2">Stop</th>
            <th className="text-right p-2">
              <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
            </th>
            <th className="text-left p-2">Reason</th>
            <th className="text-right p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="p-2 font-mono font-bold">{pos.ticker}</td>
              <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
              <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
              <td className="p-2 text-right">{formatCurrency(pos.stopPrice)}</td>
              <td className="p-2 text-right">
                <span className="text-red-600 dark:text-red-400 font-bold">
                  {formatNumber(pos.rNow, 2)}R
                </span>
              </td>
              <td className="p-2 text-sm">{pos.reason}</td>
              <td className="p-2 text-right">
                <Button variant="danger" size="sm" disabled title="Close position action not yet available">
                  Close Position
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Hold Table
function HoldTable({ positions }: { positions: DailyReviewPositionHold[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b dark:border-gray-700">
          <tr>
            <th className="text-left p-2">Ticker</th>
            <th className="text-right p-2">Entry</th>
            <th className="text-right p-2">Current</th>
            <th className="text-right p-2">Stop</th>
            <th className="text-right p-2">
              <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
            </th>
            <th className="text-left p-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="p-2 font-mono font-bold">{pos.ticker}</td>
              <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
              <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
              <td className="p-2 text-right">{formatCurrency(pos.stopPrice)}</td>
              <td className="p-2 text-right">
                <span className={pos.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {formatNumber(pos.rNow, 2)}R
                </span>
              </td>
              <td className="p-2 text-sm text-gray-600 dark:text-gray-400">{pos.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Recommendation Modal
function RecommendationModal({
  candidate,
  onClose,
}: {
  candidate: DailyReviewCandidate;
  onClose: () => void;
}) {
  const rec = candidate.recommendation;
  const verdict = rec?.verdict ?? 'NOT_RECOMMENDED';
  const verdictBadge = VERDICT_BADGES[verdict] ?? VERDICT_BADGES.NOT_RECOMMENDED;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card variant="elevated" className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Recommendation — {candidate.ticker}</h2>
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
          </div>

          <div className={`p-4 rounded ${verdict === 'RECOMMENDED' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${verdictBadge.className}`}>
                {verdictBadge.label}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">Summary</span>
            </div>
            {rec?.reasonsShort?.length ? (
              <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
                {rec.reasonsShort.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                No recommendation details available.
              </div>
            )}
          </div>

          <details className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4" open>
            <summary className="cursor-pointer font-semibold">Checklist Gates</summary>
            <div className="mt-3 space-y-2 text-sm">
              {rec?.checklist?.length ? rec.checklist.map((gate) => (
                <div key={gate.gateName} className="flex items-start gap-3">
                  <span className={`mt-0.5 h-2 w-2 rounded-full ${gate.passed ? 'bg-green-600' : 'bg-red-600'}`} />
                  <div>
                    <div className="font-medium">{gate.gateName}</div>
                    <div className="text-gray-600 dark:text-gray-400">{gate.explanation}</div>
                  </div>
                </div>
              )) : (
                <div className="text-gray-600 dark:text-gray-400">No checklist data.</div>
              )}
            </div>
          </details>

          <details className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
            <summary className="cursor-pointer font-semibold">Risk & Costs</summary>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500 dark:text-gray-400">Entry</div>
                <div className="font-semibold">{rec?.risk?.entry != null ? formatCurrency(rec.risk.entry) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Stop</div>
                <div className="font-semibold">{rec?.risk?.stop != null ? formatCurrency(rec.risk.stop) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Target</div>
                <div className="font-semibold">{rec?.risk?.target != null ? formatCurrency(rec.risk.target) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">
                  <MetricHelpLabel metricKey="RR" />
                </div>
                <div className="font-semibold">{rec?.risk?.rr != null ? rec.risk.rr.toFixed(2) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Risk Amount</div>
                <div className="font-semibold">{rec?.risk?.riskAmount != null ? formatCurrency(rec.risk.riskAmount) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">
                  <MetricHelpLabel metricKey="RISK_PCT" />
                </div>
                <div className="font-semibold">
                  {/* riskPct is a ratio from backend (0.0082 means 0.82%) */}
                  {rec?.risk?.riskPct != null ? formatRatioAsPercent(rec.risk.riskPct) : '—'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Position Size</div>
                <div className="font-semibold">{rec?.risk?.positionSize != null ? formatCurrency(rec.risk.positionSize) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Shares</div>
                <div className="font-semibold">{rec?.risk?.shares != null ? rec.risk.shares : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">Fees (est.)</div>
                <div className="font-semibold">{rec?.costs?.totalCost != null ? formatCurrency(rec.costs.totalCost) : '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">
                  <MetricHelpLabel metricKey="FEE_TO_RISK" />
                </div>
                <div className="font-semibold">
                  {/* feeToRiskPct is a ratio from backend (0.02 means 2.0%) */}
                  {rec?.costs?.feeToRiskPct != null ? formatRatioAsPercent(rec.costs.feeToRiskPct) : '—'}
                </div>
              </div>
            </div>
          </details>

          <details className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
            <summary className="cursor-pointer font-semibold">Education</summary>
            <div className="mt-3 text-sm space-y-2">
              <div>
                <div className="text-gray-500 dark:text-gray-400">Bias Warning</div>
                <div className="font-medium">{rec?.education?.commonBiasWarning ?? '—'}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400">What to Learn</div>
                <div className="font-medium">{rec?.education?.whatToLearn ?? '—'}</div>
              </div>
              {rec?.education?.whatWouldMakeValid?.length ? (
                <div>
                  <div className="text-gray-500 dark:text-gray-400">What would make this trade valid?</div>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    {rec.education.whatWouldMakeValid.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </Card>
    </div>
  );
}

// Create Order Modal
function CreateOrderModal({
  candidate,
  risk,
  onClose,
  onSuccess,
}: {
  candidate: DailyReviewCandidate;
  risk: RiskConfig;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const recRisk = candidate.recommendation?.risk;
  const suggestedEntry = recRisk?.entry ?? candidate.entry;
  const suggestedStop = recRisk?.stop ?? candidate.stop;
  const suggestedShares = recRisk?.shares ?? candidate.shares;

  const [formData, setFormData] = useState<CreateOrderRequest>({
    ticker: candidate.ticker,
    orderType: 'BUY_LIMIT',
    quantity: suggestedShares,
    limitPrice: parseFloat(suggestedEntry.toFixed(2)),
    stopPrice: parseFloat(suggestedStop.toFixed(2)),
    notes: `From daily review: Entry ${formatCurrency(candidate.entry)}, R:R ${formatNumber(candidate.rReward, 1)}`,
    orderKind: 'entry',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verdict = candidate.recommendation?.verdict ?? 'NOT_RECOMMENDED';
  const isRecommended = verdict === 'RECOMMENDED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!isRecommended) {
      setError('This setup is not recommended. Review the checklist and fix the issues first.');
      setIsSubmitting(false);
      return;
    }
    if (formData.quantity <= 0) {
      setError('Quantity must be greater than 0');
      setIsSubmitting(false);
      return;
    }
    if (!formData.limitPrice || formData.limitPrice <= 0) {
      setError('Limit price must be greater than 0');
      setIsSubmitting(false);
      return;
    }
    if (formData.stopPrice && formData.limitPrice <= formData.stopPrice) {
      setError('Limit price must be higher than stop price');
      setIsSubmitting(false);
      return;
    }

    try {
      await createOrder(formData);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const positionSize = (formData.limitPrice || 0) * formData.quantity;
  const riskAmount = formData.stopPrice ? (formData.limitPrice! - formData.stopPrice) * formData.quantity : 0;
  const riskPercent = risk.accountSize > 0 ? (riskAmount / risk.accountSize) * 100 : 0;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="presentation"
    >
      <Card
        variant="elevated"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Create Order - {candidate.ticker}</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              aria-label="Close create order modal"
              title="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded mb-4">
            <h3 className="font-semibold mb-2">Candidate Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Entry:</span>{' '}
                <strong>{formatCurrency(candidate.entry)}</strong>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Stop:</span>{' '}
                <strong>{formatCurrency(candidate.stop)}</strong>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">R:R:</span>{' '}
                <strong className="text-green-600">{formatNumber(candidate.rReward, 1)}R</strong>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Sector:</span>{' '}
                <strong>{candidate.sector || '-'}</strong>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded mb-4 ${isRecommended ? 'bg-green-50' : 'bg-red-50'}`}>
            <h3 className="font-semibold mb-2">Recommendation</h3>
            <div className="text-sm">
              <div className="font-semibold">
                {isRecommended ? 'Recommended' : 'Not Recommended'}
              </div>
              {candidate.recommendation?.reasonsShort?.length ? (
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  {candidate.recommendation.reasonsShort.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-gray-700">No recommendation details available.</div>
              )}
              {candidate.recommendation?.education?.whatWouldMakeValid?.length ? (
                <div className="mt-3">
                  <div className="font-medium">What would make it valid?</div>
                  <ul className="list-disc ml-5 mt-1 space-y-1">
                    {candidate.recommendation.education.whatWouldMakeValid.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Order Type</label>
                <select
                  value={formData.orderType}
                  onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                >
                  <option value="BUY_LIMIT">BUY LIMIT</option>
                  <option value="BUY_MARKET">BUY MARKET</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Limit Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.limitPrice}
                  onChange={(e) => setFormData({ ...formData, limitPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Stop Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.stopPrice}
                  onChange={(e) => setFormData({ ...formData, stopPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  required
                />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
              <h3 className="font-semibold mb-2">Position Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Position Size:</span>{' '}
                  <strong>{formatCurrency(positionSize)}</strong>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">% of Account:</span>{' '}
                  <strong>{risk.accountSize > 0 ? ((positionSize / risk.accountSize) * 100).toFixed(1) : '0.0'}%</strong>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Risk Amount:</span>{' '}
                  <strong className="text-red-600">{formatCurrency(riskAmount)}</strong>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Risk %:</span>{' '}
                  <strong className={riskPercent > risk.riskPct * 100 ? 'text-red-600' : 'text-green-600'}>
                    {riskPercent.toFixed(2)}%
                  </strong>
                </div>
              </div>
              {riskPercent > risk.riskPct * 100 && (
                <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">
                  ⚠️ Risk exceeds target ({(risk.riskPct * 100).toFixed(1)}%)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                rows={3}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting || !isRecommended}>
                {isSubmitting ? 'Creating...' : 'Create Order'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}
