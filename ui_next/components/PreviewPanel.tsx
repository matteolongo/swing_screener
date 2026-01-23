'use client';

import { Paper, Typography, Divider, Box } from '@mui/material';
import type { PreviewDiff } from '@/lib/types';

interface PreviewPanelProps {
  preview: PreviewDiff | null;
  error?: string | null;
}

function formatChanges(changes: Record<string, [unknown, unknown]>) {
  return Object.entries(changes).map(([key, [from, to]]) => (
    <Typography key={key} variant="body2">
      {key}: {String(from)} → {String(to)}
    </Typography>
  ));
}

export default function PreviewPanel({ preview, error }: PreviewPanelProps) {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h2" gutterBottom>
        Preview
      </Typography>
      {error && (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      )}
      {!preview && !error && (
        <Typography variant="body2" color="text.secondary">
          No preview available yet.
        </Typography>
      )}
      {preview && (
        <Box>
          <Typography variant="subtitle2">Orders</Typography>
          {preview.diff.orders.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No order changes.
            </Typography>
          )}
          {preview.diff.orders.map((item) => (
            <Box key={item.order_id} sx={{ mb: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {item.order_id}
              </Typography>
              {formatChanges(item.changes)}
            </Box>
          ))}

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2">Positions</Typography>
          {preview.diff.positions.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No position changes.
            </Typography>
          )}
          {preview.diff.positions.map((item) => (
            <Box key={item.ticker} sx={{ mb: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {item.ticker}
              </Typography>
              {formatChanges(item.changes)}
            </Box>
          ))}

          {preview.warnings.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="subtitle2">Warnings</Typography>
              {preview.warnings.map((warning, idx) => (
                <Typography key={idx} variant="body2" color="warning.main">
                  {warning}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}
