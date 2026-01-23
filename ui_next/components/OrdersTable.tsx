'use client';

import {
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
  Select,
  MenuItem,
} from '@mui/material';
import type { Order, OrderStatus } from '@/lib/types';

interface OrdersTableProps {
  orders: Order[];
  onOrderChange: (orderId: string, field: keyof Order, value: Order[keyof Order]) => void;
  onToggleLock: (orderId: string, locked: boolean) => void;
}

const statusOptions: OrderStatus[] = ['pending', 'filled', 'cancelled'];

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function OrdersTable({
  orders,
  onOrderChange,
  onToggleLock,
}: OrdersTableProps) {
  return (
    <TableContainer component={Paper} elevation={1}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Ticker</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Order Type</TableCell>
            <TableCell>Limit</TableCell>
            <TableCell>Qty</TableCell>
            <TableCell>Order Date</TableCell>
            <TableCell>Filled Date</TableCell>
            <TableCell>Entry Price</TableCell>
            <TableCell>Stop Price</TableCell>
            <TableCell>Notes</TableCell>
            <TableCell>Locked</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((order) => {
            const disabled = order.locked;
            return (
              <TableRow key={order.order_id}>
                <TableCell>
                  <Typography variant="body2">{order.ticker}</Typography>
                </TableCell>
                <TableCell>
                  <Select
                    size="small"
                    fullWidth
                    value={order.status}
                    disabled={disabled}
                    onChange={(event) =>
                      onOrderChange(order.order_id, 'status', event.target.value as OrderStatus)
                    }
                  >
                    {statusOptions.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>{order.order_type}</TableCell>
                <TableCell>{order.limit_price ?? ''}</TableCell>
                <TableCell>{order.quantity ?? ''}</TableCell>
                <TableCell>{order.order_date}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="date"
                    value={order.filled_date || ''}
                    disabled={disabled}
                    onChange={(event) =>
                      onOrderChange(order.order_id, 'filled_date', event.target.value)
                    }
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ 'data-testid': `filled-date-${order.order_id}` }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={order.entry_price ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      onOrderChange(order.order_id, 'entry_price', parseNumber(event.target.value))
                    }
                    fullWidth
                    inputProps={{ inputMode: 'decimal', 'data-testid': `entry-price-${order.order_id}` }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={order.stop_price ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      onOrderChange(order.order_id, 'stop_price', parseNumber(event.target.value))
                    }
                    fullWidth
                    inputProps={{ inputMode: 'decimal' }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={order.notes ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      onOrderChange(order.order_id, 'notes', event.target.value)
                    }
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <Checkbox
                    checked={order.locked}
                    onChange={(event) => onToggleLock(order.order_id, event.target.checked)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {!orders.length && (
            <TableRow>
              <TableCell colSpan={11}>
                <Typography variant="body2" color="text.secondary">
                  No orders available.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
