import { useState } from 'react';
import { useDailyReview } from '@/features/dailyReview/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import type {
  DailyReviewCandidate,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
  DailyReviewPositionClose,
} from '@/types/dailyReview';

export default function DailyReview() {
  const [expandedSections, setExpandedSections] = useState({
    candidates: true,
    hold: false,
    update: true,
    close: true,
  });

  const { data: review, isLoading, error } = useDailyReview(10);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Daily Review</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {new Date(summary.reviewDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
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
        title={`📈 New Trade Candidates (${review.newCandidates.length})`}
        isExpanded={expandedSections.candidates}
        onToggle={() => toggleSection('candidates')}
        count={review.newCandidates.length}
      >
        {review.newCandidates.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No new candidates today.</p>
        ) : (
          <CandidatesTable candidates={review.newCandidates} />
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
          <UpdateStopTable positions={review.positionsUpdateStop} />
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
function CandidatesTable({ candidates }: { candidates: DailyReviewCandidate[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b dark:border-gray-700">
          <tr>
            <th className="text-left p-2">Ticker</th>
            <th className="text-left p-2">Signal</th>
            <th className="text-right p-2">Entry</th>
            <th className="text-right p-2">Stop</th>
            <th className="text-right p-2">Shares</th>
            <th className="text-right p-2">R:R</th>
            <th className="text-left p-2">Sector</th>
            <th className="text-right p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate, idx) => (
            <tr key={idx} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="p-2 font-mono font-bold">{candidate.ticker}</td>
              <td className="p-2">
                <Badge variant="primary">{candidate.signal}</Badge>
              </td>
              <td className="p-2 text-right">{formatCurrency(candidate.entry)}</td>
              <td className="p-2 text-right">{formatCurrency(candidate.stop)}</td>
              <td className="p-2 text-right">{candidate.shares}</td>
              <td className="p-2 text-right font-bold">{formatNumber(candidate.rReward, 1)}R</td>
              <td className="p-2 text-sm text-gray-600 dark:text-gray-400">{candidate.sector || '-'}</td>
              <td className="p-2 text-right">
                <Button variant="primary" size="sm">Create Order</Button>
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
            <th className="text-right p-2">R Now</th>
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
                <Button variant="secondary" size="sm">Update Stop</Button>
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
            <th className="text-right p-2">R Now</th>
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
                <Button variant="danger" size="sm">Close Position</Button>
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
            <th className="text-right p-2">R Now</th>
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
