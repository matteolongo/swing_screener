import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import TableShell from '@/components/common/TableShell';
import {
  Position,
  PositionStatus,
  calculatePnL,
  calculatePnLPercent,
} from '@/features/portfolio/types';
import { calcOpenRisk, calcOpenRiskPct } from '@/features/portfolio/metrics';
import {
  usePositions,
  useOpenPositions,
  useUpdateStopMutation,
  useClosePositionMutation,
} from '@/features/portfolio/hooks';
import { formatCurrency, formatDate, formatPercent } from '@/utils/formatters';
import { TrendingUp, TrendingDown, X, MessageSquare } from 'lucide-react';
import SocialAnalysisModal from '@/components/modals/SocialAnalysisModal';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import { t } from '@/i18n/t';

type FilterStatus = PositionStatus | 'all';
const POSITION_FILTER_LABEL: Record<FilterStatus, string> = {
  all: t('positionsPage.filter.all'),
  open: t('positionsPage.filter.open'),
  closed: t('positionsPage.filter.closed'),
};
const POSITION_LIST_TITLE: Record<FilterStatus, string> = {
  all: t('positionsPage.listTitle.all'),
  open: t('positionsPage.listTitle.open'),
  closed: t('positionsPage.listTitle.closed'),
};

export default function Positions() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showUpdateStopModal, setShowUpdateStopModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [socialSymbol, setSocialSymbol] = useState<string | null>(null);

  const activeStrategyQuery = useActiveStrategyQuery();

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
        <h1 className="text-3xl font-bold">{t('positionsPage.title')}</h1>
      </div>

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
                {POSITION_FILTER_LABEL[status]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card variant="bordered">
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">{t('positionsPage.metrics.openRisk')}</div>
              <div className="text-lg font-semibold">{formatCurrency(totalOpenRisk)}</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">{t('positionsPage.metrics.openRiskPct')}</div>
              <div className="text-lg font-semibold">{openRiskPct.toFixed(2)}%</div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">{t('positionsPage.metrics.accountSize')}</div>
              <div className="text-lg font-semibold">
                {accountSize > 0 ? formatCurrency(accountSize) : t('positionsPage.accountFallback')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle>{POSITION_LIST_TITLE[filterStatus]}</CardTitle>
        </CardHeader>
        <CardContent>
          <TableShell
            loading={isLoading}
            empty={!isLoading && positions.length === 0}
            emptyMessage={t('positionsPage.empty')}
            colSpan={12}
            headers={(
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-semibold">{t('positionsPage.headers.ticker')}</th>
                <th className="text-left py-3 px-4 font-semibold">{t('positionsPage.headers.status')}</th>
                <th className="text-left py-3 px-4 font-semibold">{t('positionsPage.headers.entryDate')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('positionsPage.headers.shares')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('positionsPage.headers.entry')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('positionsPage.headers.value')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('positionsPage.headers.stop')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('positionsPage.headers.exit')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('positionsPage.headers.pnl')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('positionsPage.headers.pnlPct')}</th>
                <th className="text-left py-3 px-4 font-semibold">{t('positionsPage.headers.notes')}</th>
                <th className="text-right py-3 px-4 font-semibold">{t('positionsPage.headers.actions')}</th>
              </tr>
            )}
          >
            {positions.map((position: Position) => {
              const pnl = calculatePnL(position);
              const pnlPercent = calculatePnLPercent(position);
              const isProfitable = pnl >= 0;
              const entryValue = position.entryPrice * position.shares;
              const currentPrice =
                position.status === 'closed'
                  ? (position.exitPrice ?? position.entryPrice)
                  : (position.currentPrice ?? position.entryPrice);
              const currentValue = currentPrice * position.shares;

              return (
                <tr
                  key={position.positionId || position.ticker}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="py-3 px-4 font-mono font-semibold">
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://finance.yahoo.com/quote/${position.ticker}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                        title={t('positionsPage.yahooTitle', { ticker: position.ticker })}
                      >
                        {position.ticker}
                      </a>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSocialSymbol(position.ticker)}
                        aria-label={t('positionsPage.sentimentAria', { ticker: position.ticker })}
                        title={t('positionsPage.sentimentTitle')}
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
                  <td
                    className={`py-3 px-4 text-right ${
                      isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    <div className="font-semibold">{formatCurrency(currentValue)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {t('positionsPage.valueFrom', {
                        entryValue: formatCurrency(entryValue),
                        pnlPercent: formatPercent(pnlPercent),
                      })}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">{formatCurrency(position.stopPrice)}</td>
                  <td className="py-3 px-4 text-right">
                    {position.exitPrice ? formatCurrency(position.exitPrice) : t('positionsPage.exitFallback')}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-semibold ${
                      isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {isProfitable ? '+' : ''}
                    {formatCurrency(pnl)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-semibold ${
                      isProfitable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {formatPercent(pnlPercent)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {position.notes || t('positionsPage.notesFallback')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-2">
                      {position.status === 'open' && position.positionId ? (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleUpdateStop(position)}
                            title={t('positionsPage.updateStop')}
                          >
                            {t('positionsPage.updateStop')}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleClosePosition(position)}
                            title={t('positionsPage.closePosition')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </TableShell>
        </CardContent>
      </Card>

      {showUpdateStopModal && selectedPosition ? (
        <UpdateStopModalForm
          position={selectedPosition}
          onClose={() => {
            setShowUpdateStopModal(false);
            setSelectedPosition(null);
          }}
          onSubmit={(request) =>
            updateStopMutation.mutate({
              positionId: selectedPosition.positionId!,
              request,
            })
          }
          isLoading={updateStopMutation.isPending}
          error={updateStopMutation.error?.message}
        />
      ) : null}

      {showCloseModal && selectedPosition ? (
        <ClosePositionModalForm
          position={selectedPosition}
          onClose={() => {
            setShowCloseModal(false);
            setSelectedPosition(null);
          }}
          onSubmit={(request) =>
            closePositionMutation.mutate({
              positionId: selectedPosition.positionId!,
              request,
            })
          }
          isLoading={closePositionMutation.isPending}
          error={closePositionMutation.error?.message}
        />
      ) : null}

      {socialSymbol ? <SocialAnalysisModal symbol={socialSymbol} onClose={() => setSocialSymbol(null)} /> : null}
    </div>
  );
}
