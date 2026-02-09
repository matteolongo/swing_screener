import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { Order, OrderStatus, CreateOrderRequest, FillOrderRequest, transformOrder, transformCreateOrderRequest } from '@/types/order';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Plus, X, CheckCircle, MessageSquare } from 'lucide-react';
import SocialAnalysisModal from '@/components/modals/SocialAnalysisModal';

type FilterStatus = OrderStatus | 'all';

export default function Orders() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFillModal, setShowFillModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [socialSymbol, setSocialSymbol] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', filterStatus],
    queryFn: async () => {
      const params = filterStatus !== 'all' ? `?status=${filterStatus}` : '';
      const response = await fetch(apiUrl(API_ENDPOINTS.orders + params));
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      return data.orders.map(transformOrder);
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (request: CreateOrderRequest) => {
      const response = await fetch(apiUrl(API_ENDPOINTS.orders), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transformCreateOrderRequest(request)),
      });
      if (!response.ok) throw new Error('Failed to create order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowCreateModal(false);
    },
  });

  // Fill order mutation
  const fillOrderMutation = useMutation({
    mutationFn: async ({ orderId, request }: { orderId: string; request: FillOrderRequest }) => {
      const payload: Record<string, number | string> = {
        filled_price: request.filledPrice,
        filled_date: request.filledDate,
      };
      if (request.stopPrice && request.stopPrice > 0) {
        payload.stop_price = request.stopPrice;
      }

      const response = await fetch(apiUrl(API_ENDPOINTS.orderFill(orderId)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to fill order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowFillModal(false);
      setSelectedOrder(null);
    },
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(apiUrl(API_ENDPOINTS.order(orderId)), {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to cancel order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const handleFillOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowFillModal(true);
  };

  const handleCancelOrder = (orderId: string) => {
    if (confirm('Are you sure you want to cancel this order?')) {
      cancelOrderMutation.mutate(orderId);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Orders</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Order
        </Button>
      </div>

      {/* Filters */}
      <Card variant="bordered">
        <CardContent>
          <div className="flex gap-2">
            {(['all', 'pending', 'filled', 'cancelled'] as FilterStatus[]).map((status) => (
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

      {/* Orders Table */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>
            {filterStatus === 'all' ? 'All Orders' : `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Orders`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-600 dark:text-gray-400">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">No orders found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold">Ticker</th>
                    <th className="text-left py-3 px-4 font-semibold">Type</th>
                    <th className="text-left py-3 px-4 font-semibold">Kind</th>
                    <th className="text-right py-3 px-4 font-semibold">Qty</th>
                    <th className="text-right py-3 px-4 font-semibold">Limit</th>
                    <th className="text-right py-3 px-4 font-semibold">Stop</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Created</th>
                    <th className="text-left py-3 px-4 font-semibold">Notes</th>
                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: Order) => (
                    <tr key={order.orderId} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 font-mono font-semibold">
                        <div className="flex items-center gap-2">
                          <a 
                            href={`https://finance.yahoo.com/quote/${order.ticker}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                            title={`View ${order.ticker} on Yahoo Finance`}
                          >
                            {order.ticker}
                          </a>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSocialSymbol(order.ticker)}
                            aria-label={`Sentiment for ${order.ticker}`}
                            title="Sentiment"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{order.orderType}</td>
                      <td className="py-3 px-4">
                        <Badge variant={order.orderKind === 'entry' ? 'success' : order.orderKind === 'stop' ? 'error' : 'default'}>
                          {order.orderKind || 'N/A'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">{order.quantity}</td>
                      <td className="py-3 px-4 text-right">{order.limitPrice ? formatCurrency(order.limitPrice) : '-'}</td>
                      <td className="py-3 px-4 text-right">{order.stopPrice ? formatCurrency(order.stopPrice) : '-'}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            order.status === 'filled' ? 'success' :
                            order.status === 'pending' ? 'warning' :
                            'default'
                          }
                        >
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">{formatDate(order.orderDate)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {order.notes || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          {order.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleFillOrder(order)}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleCancelOrder(order.orderId)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Order Modal */}
      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(request) => createOrderMutation.mutate(request)}
          isLoading={createOrderMutation.isPending}
        />
      )}

      {/* Fill Order Modal */}
      {showFillModal && selectedOrder && (
        <FillOrderModal
          order={selectedOrder}
          onClose={() => {
            setShowFillModal(false);
            setSelectedOrder(null);
          }}
          onSubmit={(request) => fillOrderMutation.mutate({ orderId: selectedOrder.orderId, request })}
          isLoading={fillOrderMutation.isPending}
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

// Create Order Modal Component
function CreateOrderModal({
  onClose,
  onSubmit,
  isLoading,
}: {
  onClose: () => void;
  onSubmit: (request: CreateOrderRequest) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CreateOrderRequest>({
    ticker: '',
    orderType: 'BUY_LIMIT',
    quantity: 0,
    limitPrice: 0,
    stopPrice: 0,
    notes: '',
    orderKind: 'entry',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card variant="elevated" className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create Order</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Ticker</label>
              <input
                type="text"
                value={formData.ticker}
                onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Order Type</label>
              <select
                value={formData.orderType}
                onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              >
                <option value="BUY_LIMIT">BUY LIMIT</option>
                <option value="SELL_LIMIT">SELL LIMIT</option>
                <option value="BUY_MARKET">BUY MARKET</option>
                <option value="SELL_MARKET">SELL MARKET</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Order Kind</label>
              <select
                value={formData.orderKind}
                onChange={(e) => setFormData({ ...formData, orderKind: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              >
                <option value="entry">Entry</option>
                <option value="stop">Stop Loss</option>
                <option value="take_profit">Take Profit</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Limit Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.limitPrice}
                  onChange={(e) => setFormData({ ...formData, limitPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Stop Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.stopPrice}
                onChange={(e) => setFormData({ ...formData, stopPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
              />
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

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Order'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Fill Order Modal Component
function FillOrderModal({
  order,
  onClose,
  onSubmit,
  isLoading,
}: {
  order: Order;
  onClose: () => void;
  onSubmit: (request: FillOrderRequest) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<FillOrderRequest>({
    filledPrice: order.limitPrice || 0,
    filledDate: new Date().toISOString().split('T')[0],
    stopPrice: order.orderKind === 'entry' ? (order.stopPrice || 0) : undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card variant="elevated" className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Fill Order - {order.ticker}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Filled Price</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.filledPrice}
                onChange={(e) => setFormData({ ...formData, filledPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Filled Date</label>
              <input
                type="date"
                value={formData.filledDate}
                onChange={(e) => setFormData({ ...formData, filledDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                required
              />
            </div>

            {order.orderKind === 'entry' && (
              <div>
                <label className="block text-sm font-medium mb-1">Stop Price (for linked stop)</label>
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
            )}

            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
              <p className="text-sm text-gray-600 dark:text-gray-400">Order Details:</p>
              <p className="text-sm mt-1"><strong>Type:</strong> {order.orderType}</p>
              <p className="text-sm"><strong>Quantity:</strong> {order.quantity}</p>
              {order.limitPrice && (
                <p className="text-sm"><strong>Limit:</strong> {formatCurrency(order.limitPrice)}</p>
              )}
              {order.stopPrice && (
                <p className="text-sm"><strong>Stop:</strong> {formatCurrency(order.stopPrice)}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? 'Filling...' : 'Fill Order'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
