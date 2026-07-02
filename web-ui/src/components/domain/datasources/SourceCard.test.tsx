import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';
import { probeTone } from '@/lib/badgeMap';
import SourceCard from './SourceCard';
import type { DataSource, ProbeStatus } from '@/features/datasources/types';
import type { MessageKey } from '@/i18n/types';

const TONE_CLASS: Record<ReturnType<typeof probeTone>, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  down: 'bg-danger',
  idle: 'bg-muted/50',
};

const STATUS_LABEL_KEY: Record<ProbeStatus, MessageKey> = {
  ok: 'datasources.status.ok',
  degraded: 'datasources.status.degraded',
  down: 'datasources.status.down',
  not_configured: 'datasources.status.not_configured',
};

function makeSource(status: ProbeStatus): DataSource {
  return {
    id: 'yfinance',
    displayName: 'Yahoo Finance',
    domain: 'market_data',
    role: 'primary',
    configured: true,
    probeable: true,
    lastProbe: {
      id: 'yfinance',
      status,
      latencyMs: 120,
    },
  };
}

describe('SourceCard', () => {
  const statuses: ProbeStatus[] = ['ok', 'degraded', 'down', 'not_configured'];

  it.each(statuses)('renders a StatusDot with tone matching probeTone for status %s', (status) => {
    renderWithProviders(
      <SourceCard source={makeSource(status)} onTest={vi.fn()} testing={false} />
    );

    const dot = screen.getByRole('status');
    expect(dot).toHaveClass(TONE_CLASS[probeTone(status)]);
    expect(dot.parentElement).toHaveTextContent(t(STATUS_LABEL_KEY[status]));
  });

  it('renders exactly one status dot per card', () => {
    renderWithProviders(
      <SourceCard source={makeSource('ok')} onTest={vi.fn()} testing={false} />
    );

    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
