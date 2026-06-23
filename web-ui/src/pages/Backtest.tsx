import { useState } from 'react';

import Card from '@/components/common/Card';
import Field from '@/components/common/Field';
import Input, { CONTROL_CLASS } from '@/components/common/Input';
import Button from '@/components/common/Button';
import DataTable, { type DataTableColumn } from '@/components/common/DataTable';
import RChip from '@/components/common/RChip';
import { StatCard } from '@/components/domain/analytics/AnalyticsCards';
import { useRunEventStudyMutation } from '@/features/backtest/hooks';
import type {
  BacktestResult,
  BacktestTrade,
  EventStudyRequest,
} from '@/features/backtest/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import {
  formatNumber,
  formatPrice,
  formatR,
  formatRatioAsPercent,
  getSignColorClass,
} from '@/utils/formatters';

type PatternStopChoice = 'default' | 'on' | 'off';

function parseTickers(raw: string): string[] {
  const parts = raw
    .split(/[\s,]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  return parts.filter((p, i) => parts.indexOf(p) === i);
}

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function exitReasonLabel(reason: string): string {
  return t(`backtest.exitReason.${reason}` as MessageKey);
}

export default function Backtest() {
  const [tickersInput, setTickersInput] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [patternStop, setPatternStop] = useState<PatternStopChoice>('default');
  const [breakevenAtR, setBreakevenAtR] = useState('');
  const [kAtr, setKAtr] = useState('');
  const [rrTarget, setRrTarget] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useRunEventStudyMutation();
  const result = mutation.data;

  const handleRun = () => {
    const tickers = parseTickers(tickersInput);
    if (tickers.length === 0) {
      setValidationError(t('backtest.errors.noTickers'));
      return;
    }
    setValidationError(null);

    const config: NonNullable<EventStudyRequest['config']> = {};
    if (patternStop !== 'default') config.patternStopEnabled = patternStop === 'on';
    const be = parseOptionalNumber(breakevenAtR);
    if (be !== undefined) config.breakevenAtR = be;
    const k = parseOptionalNumber(kAtr);
    if (k !== undefined) config.kAtr = k;
    const rr = parseOptionalNumber(rrTarget);
    if (rr !== undefined) config.rrTarget = rr;

    mutation.mutate({
      tickers,
      start: start.trim() || undefined,
      end: end.trim() || undefined,
      config: Object.keys(config).length > 0 ? config : undefined,
    });
  };

  const errorMessage =
    validationError ?? (mutation.isError ? t('backtest.errors.failed') : null);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{t('backtest.title')}</h1>
        <p className="text-sm text-muted">{t('backtest.subtitle')}</p>
        <p className="text-xs text-muted/70">{t('backtest.scopeNote')}</p>
      </header>

      <Card variant="bordered" className="space-y-4">
        <Field label={t('backtest.form.tickers')} hint={t('backtest.form.tickersHint')}>
          <Input
            value={tickersInput}
            onChange={(e) => setTickersInput(e.target.value)}
            placeholder={t('backtest.form.tickersPlaceholder')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t('backtest.form.start')} hint={t('backtest.form.dateHint')}>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={t('backtest.form.end')}>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{t('backtest.form.overrides')}</p>
          <p className="text-xs text-muted">{t('backtest.form.overridesHint')}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label={t('backtest.form.patternStop')}>
            <select
              className={CONTROL_CLASS}
              value={patternStop}
              onChange={(e) => setPatternStop(e.target.value as PatternStopChoice)}
            >
              <option value="default">—</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </Field>
          <Field label={t('backtest.form.breakevenAtR')}>
            <Input
              type="number"
              step="0.1"
              value={breakevenAtR}
              onChange={(e) => setBreakevenAtR(e.target.value)}
              placeholder="1.0"
            />
          </Field>
          <Field label={t('backtest.form.kAtr')}>
            <Input
              type="number"
              step="0.1"
              value={kAtr}
              onChange={(e) => setKAtr(e.target.value)}
              placeholder="2.0"
            />
          </Field>
          <Field label={t('backtest.form.rrTarget')}>
            <Input
              type="number"
              step="0.1"
              value={rrTarget}
              onChange={(e) => setRrTarget(e.target.value)}
              placeholder="2.0"
            />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleRun} disabled={mutation.isPending}>
            {mutation.isPending ? t('backtest.form.running') : t('backtest.form.run')}
          </Button>
          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
        </div>
      </Card>

      {result ? <Results result={result} /> : null}
    </div>
  );
}

function Results({ result }: { result: BacktestResult }) {
  const { metrics, trades } = result;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('backtest.results.title')}</h2>
        <p className="text-xs text-muted">
          {t('backtest.results.window', {
            count: metrics.nTrades,
            start: result.start,
            end: result.end,
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label={t('backtest.metrics.expectancy')}
          value={formatR(metrics.expectancyR)}
          colorClass={getSignColorClass(metrics.expectancyR)}
        />
        <StatCard
          label={t('backtest.metrics.winRate')}
          value={formatRatioAsPercent(metrics.winRate)}
        />
        <StatCard
          label={t('backtest.metrics.profitFactor')}
          value={metrics.profitFactor == null ? '∞' : formatNumber(metrics.profitFactor, 2)}
        />
        <StatCard
          label={t('backtest.metrics.totalR')}
          value={formatR(metrics.totalR)}
          colorClass={getSignColorClass(metrics.totalR)}
        />
        <StatCard
          label={t('backtest.metrics.maxDrawdown')}
          value={`${formatNumber(metrics.maxDrawdownR, 2)}R`}
          colorClass="text-danger"
        />
        <StatCard label={t('backtest.metrics.trades')} value={String(metrics.nTrades)} />
      </div>

      <Card variant="bordered" className="p-0 overflow-hidden">
        <DataTable<BacktestTrade>
          rows={trades}
          getRowKey={(row, index) => `${row.ticker}-${row.entryDate}-${index}`}
          empty={trades.length === 0}
          emptyMessage={t('backtest.results.noTrades')}
          columns={tradeColumns()}
        />
      </Card>
    </section>
  );
}

function tradeColumns(): DataTableColumn<BacktestTrade>[] {
  return [
    { key: 'ticker', header: t('backtest.table.ticker'), render: (r) => r.ticker },
    { key: 'setup', header: t('backtest.table.setup'), render: (r) => r.setup },
    { key: 'entryDate', header: t('backtest.table.entryDate'), render: (r) => r.entryDate },
    {
      key: 'entryPrice',
      header: t('backtest.table.entryPrice'),
      align: 'right',
      render: (r) => formatPrice(r.entryPrice),
    },
    {
      key: 'initialStop',
      header: t('backtest.table.initialStop'),
      align: 'right',
      render: (r) => formatPrice(r.initialStop),
    },
    { key: 'exitDate', header: t('backtest.table.exitDate'), render: (r) => r.exitDate },
    {
      key: 'exitPrice',
      header: t('backtest.table.exitPrice'),
      align: 'right',
      render: (r) => formatPrice(r.exitPrice),
    },
    {
      key: 'exitReason',
      header: t('backtest.table.exitReason'),
      render: (r) => exitReasonLabel(r.exitReason),
    },
    {
      key: 'rMultiple',
      header: t('backtest.table.rMultiple'),
      align: 'right',
      render: (r) => <RChip value={r.rMultiple} />,
    },
    {
      key: 'barsHeld',
      header: t('backtest.table.barsHeld'),
      align: 'right',
      render: (r) => String(r.barsHeld),
    },
    {
      key: 'patternStop',
      header: t('backtest.table.patternStop'),
      align: 'center',
      render: (r) => (r.patternStopFired ? t('backtest.yes') : '—'),
    },
  ];
}
