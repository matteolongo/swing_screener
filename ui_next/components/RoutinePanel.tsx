'use client';

import React from 'react';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import type { ScreeningRequest, ScreeningResponse } from '@/lib/types';

interface RoutinePanelProps {
  lastRun: string | null;
  onRunScreening: (config: ScreeningRequest) => void;
  onPreview: () => void;
  onApply: () => void;
  screening: ScreeningResponse | null;
  busy?: boolean;
}

export default function RoutinePanel({
  lastRun,
  onRunScreening,
  onPreview,
  onApply,
  screening,
  busy = false,
}: RoutinePanelProps) {
  const [universe, setUniverse] = React.useState('mega');
  const [topN, setTopN] = React.useState(0);

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h2">Daily Routine</Typography>
          <Typography variant="body2" color="text.secondary">
            Last run: {lastRun || 'not set'}
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Universe"
            size="small"
            value={universe}
            onChange={(event) => setUniverse(event.target.value)}
          />
          <TextField
            label="Top N"
            size="small"
            type="number"
            value={topN}
            onChange={(event) => setTopN(Number(event.target.value || 0))}
            inputProps={{ min: 0 }}
          />
          <Button
            variant="contained"
            onClick={() => onRunScreening({ universe, top_n: topN })}
            disabled={busy}
          >
            Run Screening
          </Button>
          <Button variant="outlined" onClick={onPreview} disabled={busy}>
            Preview Changes
          </Button>
          <Button variant="contained" color="secondary" onClick={onApply} disabled={busy}>
            Apply
          </Button>
        </Stack>
        <Box>
          <Typography variant="subtitle2">Screening Preview</Typography>
          <Typography variant="body2" color="text.secondary">
            {screening ? `${screening.rows.length} rows` : 'No preview loaded.'}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
