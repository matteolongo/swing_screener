import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { useConfigStore } from '@/stores/configStore';
import { fetchActiveStrategy } from '@/lib/strategyApi';
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

export default function Dashboard() {
  const { config } = useConfigStore();
  const navigate = useNavigate();
  const activeStrategyQuery = useQuery({
    queryKey: ['strategy-active'],
    queryFn: fetchActiveStrategy,
  });
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
    ? 'Teacher-style explanation of how this strategy makes decisions.'
    : activeStrategyQuery.isError
      ? 'Using local Settings values because active strategy data could not be loaded.'
      : 'Loading strategy details...';


  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Portfolio Summary */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Portfolio Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Account Size</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(riskConfig.accountSize)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Risk Budget / Trade</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(riskBudget)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {(riskConfig.riskPct * 100).toFixed(2)}% of account
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Open Risk (at stops)</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(openRisk)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatPercent(openRiskPct * 100)} of account
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Open Positions</p>
              <p className="text-2xl font-bold mt-1">{positions.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-4 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Position Value</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalPositionValue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total P&L <span className="text-xs">(not a decision metric)</span>
              </p>
              <p className={`text-xl font-semibold mt-1 ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Includes realized P&L, FX, and fees — focus on current risk/reward instead.
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
          <CardTitle>Today's Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          {actionItems === 0 ? (
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
              <AlertCircle className="w-5 h-5" />
              <p>No action items. You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrdersCount > 0 && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {pendingOrdersCount} pending {pendingOrdersCount === 1 ? 'order' : 'orders'}
                    </p>
                    <div className="mt-2 space-y-1">
                      {orders.slice(0, 3).map((order: Order) => (
                        <div key={order.orderId} className="text-sm text-gray-600 dark:text-gray-400">
                          <Badge variant="warning" className="mr-2">{order.ticker}</Badge>
                          {order.orderType} - {order.quantity} shares @ {formatCurrency(order.stopPrice || order.limitPrice || 0)}
                        </div>
                      ))}
                      {orders.length > 3 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate('/orders')}
                          className="mt-2"
                        >
                          View all {orders.length} orders
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
                      {positions.length} open {positions.length === 1 ? 'position' : 'positions'}
                    </p>
                    <div className="mt-2 space-y-1">
                      {positions.slice(0, 3).map((pos: Position) => {
                        const pnl = calculatePnL(pos);
                        return (
                          <div key={pos.positionId} className="text-sm text-gray-600 dark:text-gray-400">
                            <Badge variant="success" className="mr-2">{pos.ticker}</Badge>
                            {pos.shares} shares @ {formatCurrency(pos.entryPrice)} 
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
                          View all {positions.length} positions
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
          <CardTitle>Daily Routine (Top 3)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            After market close, keep the routine simple and consistent.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <span className="font-semibold">DO NOTHING</span> — if there are no stop updates and no new trades.
            </li>
            <li>
              <span className="font-semibold">INCREASE STOP LOSS PRICE</span> — only move stops up when suggested.
            </li>
            <li>
              <span className="font-semibold">PLACE BUY LIMIT ORDER FOR TOP 3 screened symbols</span> — after you run the screener.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Open Orders Snapshot */}
      <Card variant="bordered">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Open Orders Snapshot</CardTitle>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => refetchSnapshots()}
            disabled={isFetchingSnapshots}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetchingSnapshots ? 'animate-spin' : ''}`} />
            Refresh Prices
          </Button>
        </CardHeader>
        <CardContent>
          {isSnapshotError && (
            <div className="mb-3 text-sm text-red-600">
              Failed to load order snapshots.
            </div>
          )}
          {snapshotOrders.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              No pending orders to review.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Ticker</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Type</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Qty</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Last</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">To Limit</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">To Stop</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Last Bar</th>
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
                        {order.lastPrice !== undefined ? formatCurrency(order.lastPrice) : '-'}
                      </td>
                      <td className="py-2 px-3 text-sm text-right">
                        {order.pctToLimit !== undefined ? formatPercent(order.pctToLimit) : '-'}
                      </td>
                      <td className="py-2 px-3 text-sm text-right">
                        {order.pctToStop !== undefined ? formatPercent(order.pctToStop) : '-'}
                      </td>
                      <td className="py-2 px-3 text-sm text-right text-gray-600">
                        {order.lastBar ? formatDateTime(order.lastBar) : '-'}
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
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="primary" className="h-20 text-lg" onClick={() => navigate('/screener')}>
              <div className="flex flex-col items-center gap-2">
                <Search className="w-6 h-6" />
                <span>Run Screener</span>
              </div>
            </Button>
            <Button variant="secondary" className="h-20 text-lg" onClick={() => navigate('/positions')}>
              <div className="flex flex-col items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                <span>Manage Positions</span>
              </div>
            </Button>
            <Button variant="secondary" className="h-20 text-lg" onClick={() => navigate('/orders')}>
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-6 h-6" />
                <span>View Orders</span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card variant="bordered" className="bg-primary/5">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Welcome to Swing Screener! Here's what to do next:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            <li>Review and customize your <a href="/settings" className="text-primary underline">Settings</a> (risk parameters, indicators)</li>
            <li>Run the Screener to find trade candidates</li>
            <li>Create orders for your best setups</li>
            <li>Track positions and manage stops</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
