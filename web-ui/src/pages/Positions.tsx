import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { fetchActiveStrategy } from '@/lib/strategyApi';
import {
  Position,
  PositionStatus,
  UpdateStopRequest,
  ClosePositionRequest,
  calculatePnL,
  calculatePnLPercent,
} from '@/features/portfolio/types';
import { calcOpenRisk, calcOpenRiskPct } from '@/features/portfolio/metrics';
import {
  usePositions,
  useOpenPositions,
  usePositionStopSuggestion,
  useUpdateStopMutation,
  useClosePositionMutation,
} from '@/features/portfolio/hooks';
import { formatCurrency, formatDate, formatPercent } from '@/utils/formatters';
import { TrendingUp, TrendingDown, X, MessageSquare } from 'lucide-react';
import SocialAnalysisModal from '@/components/modals/SocialAnalysisModal';

type FilterStatus = PositionStatus | 'all';

export default function Positions() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showUpdateStopModal, setShowUpdateStopModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [socialSymbol, setSocialSymbol] = useState<string | null>(null);

  const activeStrategyQuery = useQuery({
    queryKey: ['strategy-active'],
    queryFn: fetchActiveStrategy,
  });

  const positionsQuery = usePositions(filterStatus);
  const positions = positionsQuery.data ?? [];
  const isLoading = positionsQuery.isLoading;

  const openPositionsQuery = useOpenPositions();
  const openPositions = openPositionsQuery.data ?? [];

  const accountSize = activeStrategyQuery.data?.risk.accountSize ?? 0;
  const totalOpenRisk = calcOpenRisk(openPositions);
  const openRiskPct = calcOpenRiskPct(totalOpenRisk, accountSize) * 100;

  const updateStopMutation = useUpdateStopMutation(() => {
    setShowUpdateStopModal(false);
    setSelectedPosition(null);
  });

  const closePositionMutation = useClosePositionMutation(() => {
    setShowCloseModal(false);
    setSelectedPosition(null);
  });

  const handleUpdateStop = (position: Position) => {
    setSelectedPosition(position);
    setShowUpdateStopModal(true);
  };

  const handleClosePosition = (position: Position) => {
    setSelectedPosition(position);
    setShowCloseModal(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Positions</h1>
      </div>

      {/* Filters */}
      <Card variant="bordered">
        <CardContent>
          <div className="flex gap-2">
            {(['all', 'open', 'closed'] as FilterStatus[]).map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFilterStatus(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">Open Risk</div>
              <div className="text-lg font-semibold">{formatCurrency(totalOpenRisk)}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Open Risk %</div>
              <div className="text-lg font-semibold">{openRiskPct.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Account Size</div>
              <div className="text-lg font-semibold">
                {accountSize > 0 ? formatCurrency(accountSize) : '—'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positions Table */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>
            {filterStatus === 'all' ? 'All Positions' : `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Positions`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-600 dark:text-gray-400">Loading positions...</p>
          ) : positions.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">No positions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold">Ticker</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Entry Date</th>
                    <th className="text-right py-3 px-4 font-semibold">Shares</th>
                    <th className="text-right py-3 px-4 font-semibold">Entry</th>
                    <th className="text-right py-3 px-4 font-semibold">Value</th>
                    <th className="text-right py-3 px-4 font-semibold">Stop</th>
                    <th className="text-right py-3 px-4 font-semibold">Exit</th>
                    <th className="text-right py-3 px-4 font-semibold">P&L</th>
                    <th className="text-right py-3 px-4 font-semibold">P&L %</th>
                    <th className="text-left py-3 px-4 font-semibold">Notes</th>
                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position: Position) => {
                    const pnl = calculatePnL(position);
                    const pnlPercent = calculatePnLPercent(position);
                    const isProfitable = pnl >= 0;
                    const entryValue = position.entryPrice * position.shares;
                    const currentPrice = position.status === 'closed'
                      ? (position.exitPrice ?? position.entryPrice)
                      : (position.currentPrice ?? position.entryPrice);
                    const currentValue = currentPrice * position.shares;

                    return (
                      <tr key={position.positionId || position.ticker} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4 font-mono font-semibold">
                          <div className="flex items-center gap-2">
                            <a 
                              href={`https://finance.yahoo.com/quote/${position.ticker}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                              title={`View ${position.ticker} on Yahoo Finance`}
                            >
                              {position.ticker}
                            </a>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSocialSymbol(position.ticker)}
                              aria-label={`Sentiment for ${position.ticker}`}
                              title="Sentiment"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={position.status === 'open' ? 'success' : 'default'}>
                            {position.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">{formatDate(position.entryDate)}</td>
                        <td className="py-3 px-4 text-right">{position.shares}</td>
                        <td className="py-3 px-4 text-right">{formatCurrency(position.entryPrice)}</td>
                        <td className={`py-3 px-4 text-right ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          <div className="font-semibold">{formatCurrency(currentValue)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            from {formatCurrency(entryValue)} ({formatPercent(pnlPercent)})
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">{formatCurrency(position.stopPrice)}</td>
                        <td className="py-3 px-4 text-right">
                          {position.exitPrice ? formatCurrency(position.exitPrice) : '-'}
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isProfitable ? '+' : ''}{formatCurrency(pnl)}
                        </td>
                        <td className={`py-3 px-4 text-right font-semibold ${isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {formatPercent(pnlPercent)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                          {position.notes || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            {position.status === 'open' && position.positionId && (
                              <>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleUpdateStop(position)}
                                  title="Update Stop"
                                >
                                  Update Stop
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleClosePosition(position)}
                                  title="Close Position"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Stop Modal */}
      {showUpdateStopModal && selectedPosition && (
        <UpdateStopModal
          position={selectedPosition}
          onClose={() => {
            setShowUpdateStopModal(false);
            setSelectedPosition(null);
          }}
          onSubmit={(request) => updateStopMutation.mutate({ 
            positionId: selectedPosition.positionId!, 
            request 
          })}
          isLoading={updateStopMutation.isPending}
          error={updateStopMutation.error?.message}
        />
      )}

      {/* Close Position Modal */}
      {showCloseModal && selectedPosition && (
        <ClosePositionModal
          position={selectedPosition}
          onClose={() => {
            setShowCloseModal(false);
            setSelectedPosition(null);
          }}
          onSubmit={(request) => closePositionMutation.mutate({ 
            positionId: selectedPosition.positionId!, 
            request 
          })}
          isLoading={closePositionMutation.isPending}
          error={closePositionMutation.error?.message}
        />
      )}

      {socialSymbol && (
        <SocialAnalysisModal
          symbol={socialSymbol}
          onClose={() => setSocialSymbol(null)}
        />
      )}
    </div>
  );
}

// Update Stop Modal Component
function UpdateStopModal({
  position,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  position: Position;
  onClose: () => void;
  onSubmit: (request: UpdateStopRequest) => void;
  isLoading: boolean;
  error?: string;
}) {
  const suggestionQuery = usePositionStopSuggestion(position.positionId);
  const suggestion = suggestionQuery.data;
  const suggestionError = suggestionQuery.error instanceof Error ? suggestionQuery.error.message : '';
  const suggestedStop = suggestion?.stopSuggested;
  const canApplySuggested =
    suggestion?.action === 'MOVE_STOP_UP' &&
    suggestedStop != null &&
    suggestedStop > position.stopPrice;

  // Pre-fill with suggested stop if available, otherwise use current stop
  const initialStop = canApplySuggested && suggestedStop != null ? suggestedStop : position.stopPrice;
  const initialReason = canApplySuggested && suggestion?.reason ? suggestion.reason : '';
  
  const [formData, setFormData] = useState<UpdateStopRequest>({
    newStop: initialStop,
    reason: initialReason,
  });

  // Update form when suggestion loads
  React.useEffect(() => {
    if (canApplySuggested && suggestedStop != null) {
      setFormData({
        newStop: suggestedStop,
        reason: suggestion?.reason || '',
      });
    }
  }, [canApplySuggested, suggestedStop, suggestion?.reason]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleUseSuggested = () => {
    if (!canApplySuggested || suggestedStop == null) return;
    setFormData((prev) => ({
      ...prev,
      newStop: suggestedStop,
      reason: prev.reason || suggestion?.reason || '',
    }));
  };

  const canMoveUp = formData.newStop > position.stopPrice;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Update Stop - {position.ticker}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <p className="text-sm text-gray-600 dark:text-gray-400">Current Position:</p>
              <p className="text-sm mt-1"><strong>Entry:</strong> {formatCurrency(position.entryPrice)}</p>
              <p className="text-sm"><strong>Current Stop:</strong> {formatCurrency(position.stopPrice)}</p>
              <p className="text-sm"><strong>Shares:</strong> {position.shares}</p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
              <p className="text-sm text-blue-700 dark:text-blue-200 font-semibold">Suggested Stop</p>
              {suggestionQuery.isLoading ? (
                <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">Loading suggestion...</p>
              ) : suggestionError ? (
                <p className="text-sm text-red-700 dark:text-red-200 mt-1">{suggestionError}</p>
              ) : suggestion ? (
                <div className="text-sm text-blue-800 dark:text-blue-100 mt-2 space-y-1">
                  <p><strong>Suggested:</strong> {formatCurrency(suggestedStop ?? position.stopPrice)}</p>
                  <p><strong>Action:</strong> {suggestion.action}</p>
                  <p><strong>Reason:</strong> {suggestion.reason}</p>
                  <p><strong>R now:</strong> {suggestion.rNow.toFixed(2)}R</p>
                  {canApplySuggested ? (
                    <Button type="button" size="sm" variant="secondary" onClick={handleUseSuggested}>
                      Use Suggested
                    </Button>
                  ) : (
                    <p className="text-xs text-blue-700 dark:text-blue-200">No stop update suggested.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">Suggestion unavailable.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">New Stop Price</label>
              <input
                type="number"
                step="0.01"
                min={position.stopPrice}
                value={formData.newStop}
                onChange={(e) => setFormData({ ...formData, newStop: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                required
              />
              {!canMoveUp && formData.newStop !== position.stopPrice && (
                <p className="text-sm text-red-600 mt-1">⚠️ Stop can only move UP (risk protection)</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                rows={2}
                placeholder="e.g., trailing stop after +2R"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading || !canMoveUp}>
                {isLoading ? 'Updating...' : 'Update Stop'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Close Position Modal Component
function ClosePositionModal({
  position,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  position: Position;
  onClose: () => void;
  onSubmit: (request: ClosePositionRequest) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState<ClosePositionRequest>({
    exitPrice: position.entryPrice,
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const pnl = (formData.exitPrice - position.entryPrice) * position.shares;
  const pnlPercent = ((formData.exitPrice - position.entryPrice) / position.entryPrice) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Close Position - {position.ticker}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <p className="text-sm text-gray-600 dark:text-gray-400">Position Details:</p>
              <p className="text-sm mt-1"><strong>Entry:</strong> {formatCurrency(position.entryPrice)}</p>
              <p className="text-sm"><strong>Shares:</strong> {position.shares}</p>
              <p className="text-sm"><strong>Stop:</strong> {formatCurrency(position.stopPrice)}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Exit Price</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.exitPrice}
                onChange={(e) => setFormData({ ...formData, exitPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                required
              />
            </div>

            <div className={`p-3 rounded ${pnl >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <p className="text-sm font-medium">Projected P&L:</p>
              <p className={`text-lg font-bold ${pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)} ({pnl >= 0 ? '+' : ''}{formatPercent(pnlPercent)})
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Reason</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                rows={2}
                placeholder="e.g., profit target reached, stopped out"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Closing...' : 'Close Position'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
