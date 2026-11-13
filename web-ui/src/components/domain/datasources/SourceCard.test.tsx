import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SourceCard from './SourceCard';
import FallbackFeed from './FallbackFeed';
import { t } from '@/i18n/t';
import { formatDateTime } from '@/utils/formatters';
import type { DataSource } from '@/features/datasources/types';

const base: DataSource = {
  id: 'polygon',
  displayName: 'Polygon',
  domain: 'market_data',
  role: 'fallback',
  configured: true,
  probeable: true,
};

describe('SourceCard', () => {
  it('shows why a probe is down and when it ran', () => {
    render(
      <SourceCard
        source={{
          ...base,
          lastProbe: { id: 'polygon', status: 'down', error: 'HTTP 403 forbidden', checkedAt: '2026-11-12T21:05:00+00:00' },
        }}
        onTest={() => {}}
        testing={false}
      />,
    );

    expect(screen.getByText(t('datasources.status.down'), { exact: false })).toBeInTheDocument();
    expect(screen.getByText(t('datasources.probeError', { message: 'HTTP 403 forbidden' }))).toBeInTheDocument();
    expect(
      screen.getByText(t('datasources.checkedAt', { time: formatDateTime('2026-11-12T21:05:00+00:00') })),
    ).toBeInTheDocument();
  });

  it('omits the error line for a healthy probe', () => {
    render(<SourceCard source={{ ...base, lastProbe: { id: 'polygon', status: 'ok' } }} onTest={() => {}} testing={false} />);

    const errorPrefix = t('datasources.probeError', { message: '' }).trim();
    expect(screen.queryByText((content) => content.startsWith(errorPrefix))).not.toBeInTheDocument();
  });
});

describe('FallbackFeed', () => {
  it('shows when each fallback happened', () => {
    const ts = '2026-11-12T20:00:00+00:00';
    render(<FallbackFeed events={[{ ts, domain: 'market_data', fromProvider: 'yfinance', reason: 'stale_cache', tickers: [] }]} />);

    expect(screen.getByText(formatDateTime(ts))).toHaveAttribute('dateTime', ts);
  });
});
