import { useNavigate } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { useConfigStore } from '@/stores/configStore';
import {
  Position,
  Order,
  calculatePnL,
} from '@/features/portfolio/types';
import { calcOpenRisk, calcOpenRiskPct, calcTotalPositionValue } from '@/features/portfolio/metrics';
import {
  useOpenPositions,
  useOrders,
  useOrderSnapshots,
} from '@/features/portfolio/hooks';
import { formatCurrency, formatDateTime, formatPercent } from '@/utils/formatters';
import { TrendingUp, AlertCircle, FileText, Search, RefreshCw } from 'lucide-react';
import StrategyCoachCard from '@/components/domain/education/StrategyCoachCard';
import { buildFallbackStrategyCoachSections, buildStrategyCoachSections } from '@/content/strategyCoach';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { t } from '@/i18n/t';

export default function Dashboard() {
  const { config } = useConfigStore();
  const navigate = useNavigate();
  const activeStrategyQuery = useActiveStrategyQuery();
  const riskConfig = activeStrategyQuery.data?.risk ?? config.risk;

  const { data: positions = [] } = useOpenPositions();
  const { data: orders = [] } = useOrders('pending');
  const {
    data: orderSnapshots,
    isFetching: isFetchingSnapshots,
    isError: isSnapshotError,
    refetch: refetchSnapshots,
  } = useOrderSnapshots();

  const snapshotOrders = orderSnapshots?.orders ?? [];

  // Calculate portfolio metrics
  const totalPositionValue = calcTotalPositionValue(positions);
  const totalPnL = positions.reduce((sum: number, pos: Position) => {
    return sum + calculatePnL(pos);
  }, 0);

  const openRisk = calcOpenRisk(positions);
  const openRiskPct = calcOpenRiskPct(openRisk, riskConfig.accountSize);
  const riskBudget = riskConfig.accountSize * riskConfig.riskPct;

  const pendingOrdersCount = orders.length;
  const actionItems = pendingOrdersCount;
  const strategyCoachSections = activeStrategyQuery.data
    ? buildStrategyCoachSections(activeStrategyQuery.data)
    : buildFallbackStrategyCoachSections(config);
  const strategyCoachSubtitle = activeStrategyQuery.data
    ? t('dashboardPage.strategyCoach.subtitleActive')
    : activeStrategyQuery.isError
      ? t('dashboardPage.strategyCoach.subtitleFallback')
      : t('dashboardPage.strategyCoach.subtitleLoading');


  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">{t('dashboardPage.header.title')}</h1>

      {/* Portfolio Summary */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>{t('dashboardPage.portfolioSummary.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboardPage.portfolioSummary.accountSize')}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(riskConfig.accountSize)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboardPage.portfolioSummary.riskBudgetPerTrade')}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(riskBudget)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t('dashboardPage.portfolioSummary.percentOfAccount', {
                  value: (riskConfig.riskPct * 100).toFixed(2),
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboardPage.portfolioSummary.openRiskAtStops')}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(openRisk)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {t('dashboardPage.portfolioSummary.percentOfAccount', {
                  value: formatPercent(openRiskPct * 100),
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboardPage.portfolioSummary.openPositions')}</p>
              <p className="text-2xl font-bold mt-1">{positions.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-4 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('dashboardPage.portfolioSummary.positionValue')}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalPositionValue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('dashboardPage.portfolioSummary.totalPnl')}{' '}
                <span className="text-xs">{t('dashboardPage.portfolioSummary.totalPnlDisclaimer')}</span>
              </p>
              <p className={`text-xl font-semibold mt-1 ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t('dashboardPage.portfolioSummary.totalPnlDetail')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <StrategyCoachCard
        strategyName={activeStrategyQuery.data?.name}
        subtitle={strategyCoachSubtitle}
        sections={strategyCoachSections}
        isLoading={activeStrategyQuery.isLoading && !activeStrategyQuery.data}
      />

      {/* Action Items */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('dashboardPage.actionItems.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {actionItems === 0 ? (
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <AlertCircle className="w-5 h-5" />
              <p>{t('dashboardPage.actionItems.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrdersCount > 0 && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {pendingOrdersCount === 1
                        ? t('dashboardPage.actionItems.pendingOrderSingular', { count: pendingOrdersCount })
                        : t('dashboardPage.actionItems.pendingOrderPlural', { count: pendingOrdersCount })}
                    </p>
                    <div className="mt-2 space-y-1">
                      {orders.slice(0, 3).map((order: Order) => (
                        <div key={order.orderId} className="text-sm text-gray-600 dark:text-gray-400">
                          <Badge variant="warning" className="mr-2">{order.ticker}</Badge>
                          {t('dashboardPage.actionItems.orderRow', {
                            orderType: order.orderType,
                            quantity: order.quantity,
                            price: formatCurrency(order.stopPrice || order.limitPrice || 0),
                          })}
                        </div>
                      ))}
                      {orders.length > 3 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate('/orders')}
                          className="mt-2"
                        >
                          {t('dashboardPage.actionItems.viewAllOrders', { count: orders.length })}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {positions.length > 0 && (
                <div className="flex items-start gap-3 pt-3 border-t">
                  <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {positions.length === 1
                        ? t('dashboardPage.actionItems.openPositionSingular', { count: positions.length })
                        : t('dashboardPage.actionItems.openPositionPlural', { count: positions.length })}
                    </p>
                    <div className="mt-2 space-y-1">
                      {positions.slice(0, 3).map((pos: Position) => {
                        const pnl = calculatePnL(pos);
                        return (
                          <div key={pos.positionId} className="text-sm text-gray-600 dark:text-gray-400">
                            <Badge variant="success" className="mr-2">{pos.ticker}</Badge>
                            {t('dashboardPage.actionItems.positionRow', {
                              quantity: pos.shares,
                              entry: formatCurrency(pos.entryPrice),
                            })}{' '}
                            <span className={`ml-2 font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ({pnl >= 0 ? '+' : ''}{formatCurrency(pnl)})
                            </span>
                          </div>
                        );
                      })}
                      {positions.length > 3 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate('/positions')}
                          className="mt-2"
                        >
                          {t('dashboardPage.actionItems.viewAllPositions', { count: positions.length })}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Routine */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('dashboardPage.dailyRoutine.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('dashboardPage.dailyRoutine.subtitle')}
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <span className="font-semibold">{t('dashboardPage.dailyRoutine.steps.doNothingLead')}</span>{' '}
              {t('dashboardPage.dailyRoutine.steps.doNothingBody')}
            </li>
            <li>
              <span className="font-semibold">{t('dashboardPage.dailyRoutine.steps.increaseStopLead')}</span>{' '}
              {t('dashboardPage.dailyRoutine.steps.increaseStopBody')}
            </li>
            <li>
              <span className="font-semibold">{t('dashboardPage.dailyRoutine.steps.placeBuyLead')}</span>{' '}
              {t('dashboardPage.dailyRoutine.steps.placeBuyBody')}
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Open Orders Snapshot */}
      <Card variant="bordered">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{t('dashboardPage.openOrdersSnapshot.title')}</CardTitle>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => refetchSnapshots()}
            disabled={isFetchingSnapshots}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetchingSnapshots ? 'animate-spin' : ''}`} />
            {t('dashboardPage.openOrdersSnapshot.refreshPrices')}
          </Button>
        </CardHeader>
        <CardContent>
          {isSnapshotError && (
            <div className="mb-3 text-sm text-red-600">
              {t('dashboardPage.openOrdersSnapshot.loadError')}
            </div>
          )}
          {snapshotOrders.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('dashboardPage.openOrdersSnapshot.empty')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">{t('dashboardPage.openOrdersSnapshot.headers.ticker')}</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">{t('dashboardPage.openOrdersSnapshot.headers.type')}</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">{t('dashboardPage.openOrdersSnapshot.headers.qty')}</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">{t('dashboardPage.openOrdersSnapshot.headers.last')}</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">{t('dashboardPage.openOrdersSnapshot.headers.toLimit')}</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">{t('dashboardPage.openOrdersSnapshot.headers.toStop')}</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">{t('dashboardPage.openOrdersSnapshot.headers.lastBar')}</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshotOrders.map((order) => (
                    <tr key={order.orderId} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-sm font-medium text-gray-900">
                        {order.ticker}
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-700">
                        {order.orderType}
                      </td>
                      <td className="py-2 px-3 text-sm text-right text-gray-700">
                        {order.quantity}
                      </td>
                      <td className="py-2 px-3 text-sm text-right text-gray-900">
                        {order.lastPrice !== undefined ? formatCurrency(order.lastPrice) : t('common.placeholders.dash')}
                      </td>
                      <td className="py-2 px-3 text-sm text-right">
                        {order.pctToLimit !== undefined ? formatPercent(order.pctToLimit) : t('common.placeholders.dash')}
                      </td>
                      <td className="py-2 px-3 text-sm text-right">
                        {order.pctToStop !== undefined ? formatPercent(order.pctToStop) : t('common.placeholders.dash')}
                      </td>
                      <td className="py-2 px-3 text-sm text-right text-gray-600">
                        {order.lastBar ? formatDateTime(order.lastBar) : t('common.placeholders.dash')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('dashboardPage.quickActions.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="primary" className="h-20 text-lg" onClick={() => navigate('/screener')}>
              <div className="flex flex-col items-center gap-2">
                <Search className="w-6 h-6" />
                <span>{t('dashboardPage.quickActions.runScreener')}</span>
              </div>
            </Button>
            <Button variant="secondary" className="h-20 text-lg" onClick={() => navigate('/positions')}>
              <div className="flex flex-col items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                <span>{t('dashboardPage.quickActions.managePositions')}</span>
              </div>
            </Button>
            <Button variant="secondary" className="h-20 text-lg" onClick={() => navigate('/orders')}>
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-6 h-6" />
                <span>{t('dashboardPage.quickActions.viewOrders')}</span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card variant="bordered" className="bg-primary/5">
        <CardHeader>
          <CardTitle>{t('dashboardPage.gettingStarted.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            {t('dashboardPage.gettingStarted.subtitle')}
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>{t('dashboardPage.gettingStarted.step1Prefix')} <a href="/settings" className="text-primary underline">{t('dashboardPage.gettingStarted.step1LinkLabel')}</a> {t('dashboardPage.gettingStarted.step1Suffix')}</li>
            <li>{t('dashboardPage.gettingStarted.step2')}</li>
            <li>{t('dashboardPage.gettingStarted.step3')}</li>
            <li>{t('dashboardPage.gettingStarted.step4')}</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
