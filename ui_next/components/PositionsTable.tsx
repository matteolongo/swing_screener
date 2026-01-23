'use client';

import {
  Checkbox,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { Position, PositionStatus } from '@/lib/types';

interface PositionsTableProps {
  positions: Position[];
  onPositionChange: (ticker: string, field: keyof Position, value: Position[keyof Position]) => void;
  onToggleLock: (ticker: string, locked: boolean) => void;
}

const statusOptions: PositionStatus[] = ['open', 'closed'];

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PositionsTable({
  positions,
  onPositionChange,
  onToggleLock,
}: PositionsTableProps) {
  return (
    <TableContainer component={Paper} elevation={1}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Ticker</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Entry Date</TableCell>
            <TableCell>Entry Price</TableCell>
            <TableCell>Stop Price</TableCell>
            <TableCell>Shares</TableCell>
            <TableCell>Notes</TableCell>
            <TableCell>Locked</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {positions.map((position) => {
            const disabled = position.locked;
            return (
              <TableRow key={position.ticker}>
                <TableCell>
                  <Typography variant="body2">{position.ticker}</Typography>
                </TableCell>
                <TableCell>
                  <Select
                    size="small"
                    fullWidth
                    value={position.status}
                    disabled={disabled}
                    onChange={(event) =>
                      onPositionChange(
                        position.ticker,
                        'status',
                        event.target.value as PositionStatus
                      )
                    }
                  >
                    {statusOptions.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>{position.entry_date}</TableCell>
                <TableCell>{position.entry_price ?? ''}</TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={position.stop_price ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      onPositionChange(
                        position.ticker,
                        'stop_price',
                        parseNumber(event.target.value)
                      )
                    }
                    fullWidth
                    inputProps={{ inputMode: 'decimal', 'data-testid': `stop-price-${position.ticker}` }}
                  />
                </TableCell>
                <TableCell>{position.shares ?? ''}</TableCell>
                <TableCell>{position.notes ?? ''}</TableCell>
                <TableCell>
                  <Checkbox
                    checked={position.locked}
                    onChange={(event) => onToggleLock(position.ticker, event.target.checked)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {!positions.length && (
            <TableRow>
              <TableCell colSpan={8}>
                <Typography variant="body2" color="text.secondary">
                  No positions available.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
