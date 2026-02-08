import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { useConfigStore } from '@/stores/configStore';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { Position, transformPosition, calculatePnL } from '@/types/position';
import { Order, transformOrder } from '@/types/order';
import { formatCurrency } from '@/utils/formatters';
import { TrendingUp, AlertCircle, FileText, Search } from 'lucide-react';

export default function Dashboard() {
  const { config } = useConfigStore();
  const navigate = useNavigate();

  // Fetch open positions
  const { data: positions = [] } = useQuery({
    queryKey: ['positions', 'open'],
    queryFn: async () => {
      const response = await fetch(apiUrl(API_ENDPOINTS.positions + '?status=open'));
      if (!response.ok) throw new Error('Failed to fetch positions');
      const data = await response.json();
      return data.positions.map(transformPosition);
    },
  });

  // Fetch pending orders
  const { data: orders = [] } = useQuery({
    queryKey: ['orders', 'pending'],
    queryFn: async () => {
      const response = await fetch(apiUrl(API_ENDPOINTS.orders + '?status=pending'));
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      return data.orders.map(transformOrder);
    },
  });

  // Calculate portfolio metrics
  const totalPositionValue = positions.reduce((sum: number, pos: Position) => {
    return sum + (pos.entryPrice * pos.shares);
  }, 0);

  const totalPnL = positions.reduce((sum: number, pos: Position) => {
    return sum + calculatePnL(pos);
  }, 0);

  const pendingOrdersCount = orders.length;
  const actionItems = pendingOrdersCount;


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
              <p className="text-2xl font-bold mt-1">{formatCurrency(config.risk.accountSize)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Open Positions</p>
              <p className="text-2xl font-bold mt-1">{positions.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Position Value</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalPositionValue)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total P&L</p>
              <p className={`text-2xl font-bold mt-1 ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
