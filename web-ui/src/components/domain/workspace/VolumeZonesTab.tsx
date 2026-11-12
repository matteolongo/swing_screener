import { lazy, Suspense, useMemo } from 'react';
import type { ChartVolumeZone } from '@/components/domain/market/CandleChart';
import { useTickerCandles } from '@/features/screener/hooks';
import { TickerCandlesIdentityError } from '@/features/screener/types';
import {
  DEFAULT_VOLUME_LOOKBACK,
  DEFAULT_VOLUME_MIN_RR,
  useVolumeAnalysisQuery,
} from '@/features/volumeZones/hooks';
import { VolumeAnalysisIdentityError } from '@/features/volumeZones/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import type { WorkspaceSourceState } from '@/features/workspaceData/types';
import { formatDateTime, formatNumber } from '@/utils/formatters';
import SourceHealthSummary from './SourceHealthSummary';

const K = 'workspacePage.panels.analysis.volumeZones';
const tk = (leaf: string) => t(`${K}.${leaf}` as MessageKey);
const valueLabels: Record<string, MessageKey> = {
  Long: `${K}.actions.long`, Short: `${K}.actions.short`, Watch: `${K}.actions.watch`, 'No Trade': `${K}.actions.noTrade`,
  bullish: `${K}.biases.bullish`, bearish: `${K}.biases.bearish`, neutral: `${K}.biases.neutral`,
  hvn_support_retest: `${K}.setups.hvnSupportRetest`, poc_support_retest: `${K}.setups.pocSupportRetest`,
  hvn_resistance_retest: `${K}.setups.hvnResistanceRetest`, poc_resistance_retest: `${K}.setups.pocResistanceRetest`,
  buyer_defense: `${K}.roles.buyerDefense`, seller_defense: `${K}.roles.sellerDefense`,
  poc: `${K}.poc`, hvn: `${K}.hvn`, lvn: `${K}.lvn`,
};
const valueLabel = (value: string | null | undefined) => {
  const key = value != null && Object.prototype.hasOwnProperty.call(valueLabels, value) ? valueLabels[value] : undefined;
  return key ? t(key) : tk('unavailable');
};
const finiteNumber = (value: number | null | undefined, decimals = 2) =>
  typeof value === 'number' && Number.isFinite(value) ? formatNumber(value, decimals) : tk('unavailable');
const CandleChart = lazy(() =>
  import('@/components/domain/market/CandleChart').then((module) => ({ default: module.CandleChart })),
);

function ChartLoadingFallback() {
  return (
    <div
      className="flex h-[360px] w-full items-center justify-center rounded border border-border bg-surface text-sm text-muted"
      role="status"
    >
      {t('chart.loading')}
    </div>
  );
}

interface VolumeZonesTabProps {
  ticker: string;
  lookback?: number;
  minRr?: number;
  sources?: WorkspaceSourceState[];
}

export default function VolumeZonesTab({
  ticker,
  lookback = DEFAULT_VOLUME_LOOKBACK,
  minRr = DEFAULT_VOLUME_MIN_RR,
  sources = [],
}: VolumeZonesTabProps) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const analysisQuery = useVolumeAnalysisQuery(normalizedTicker, true, lookback, minRr);
  const candlesQuery = useTickerCandles(normalizedTicker);

  const analysis = analysisQuery.data;
  const zones = useMemo<ChartVolumeZone[]>(
    () =>
      (analysis?.volumeZones ?? []).map((z) => ({
        kind: z.kind,
        center: z.center,
        priceLow: z.priceLow,
        priceHigh: z.priceHigh,
        volumeShare: z.volumeShare,
      })),
    [analysis?.volumeZones],
  );

  const identityMismatch = analysisQuery.error instanceof VolumeAnalysisIdentityError;
  if (identityMismatch) {
    return (
      <div className="space-y-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
        <div>{t('workspacePage.data.identityMismatch')}</div>
        <button
          type="button"
          className="rounded border border-danger/40 px-3 py-1.5 font-medium"
          onClick={() => void analysisQuery.refetch()}
          disabled={analysisQuery.isFetching}
        >
          {t('workspacePage.data.retryAnalysis')}
        </button>
      </div>
    );
  }

  const candleIdentityMismatch = candlesQuery.error instanceof TickerCandlesIdentityError;
  const unavailable = tk('unavailable');
  const fetchedAt = candlesQuery.data?.fetchedAt && Number.isFinite(Date.parse(candlesQuery.data.fetchedAt))
    ? formatDateTime(candlesQuery.data.fetchedAt)
    : unavailable;

  return (
    <div className="space-y-3">
      <SourceHealthSummary sources={sources} />
      {analysisQuery.isLoading && !analysis && (
        <div className="text-sm text-muted">{tk('loading')}</div>
      )}
      {analysisQuery.isError && !analysis && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          <div>
            <span className="mr-2 font-semibold text-warning">{t('workspacePage.data.partial')}</span>
            <span className="text-danger">{tk('loadError')}</span>
          </div>
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 font-medium"
            onClick={() => void analysisQuery.refetch()}
            disabled={analysisQuery.isFetching}
          >
            {t('workspacePage.data.retryAnalysis')}
          </button>
        </div>
      )}
      {candlesQuery.isLoading && !candlesQuery.data && (
        <div className="text-sm text-muted" role="status">
          {tk('candlesLoading')}
        </div>
      )}
      {candlesQuery.isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <div>
            <span className="mr-2 font-semibold text-warning">{t('workspacePage.data.partial')}</span>
            <span>
              {candleIdentityMismatch ? t('workspacePage.data.identityMismatch') : tk('candlesFailed')}
            </span>
          </div>
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 font-medium"
            onClick={() => void candlesQuery.refetch()}
            disabled={candlesQuery.isFetching}
          >
            {t('workspacePage.data.retryPrices')}
          </button>
        </div>
      )}

      {analysis && <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{tk('summary')}</div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-lg font-semibold">{valueLabel(analysis.action)}</span>
          <span>
            {tk('bias')}: {valueLabel(analysis.marketBias)}
          </span>
          <span>
            {tk('setup')}: {!analysis.setupType || analysis.setupType === 'none' ? tk('noSetup') : valueLabel(analysis.setupType)}
          </span>
          <span>
            <span>{tk('confidence')}</span>: {finiteNumber(analysis.confidenceScore, 1)}
          </span>
        </div>
        {analysis.tradePlan.entry != null && (
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
            <span>
              {tk('entry')}: {finiteNumber(analysis.tradePlan.entry)}
            </span>
            <span>
              {tk('stop')}: {finiteNumber(analysis.tradePlan.stop)}
            </span>
            <span>
              {tk('target')}: {finiteNumber(analysis.tradePlan.target)}
            </span>
            <span>
              {tk('rr')}: {finiteNumber(analysis.tradePlan.rr)}
            </span>
          </div>
        )}
      </div>}

      <div className="rounded-lg border border-border bg-surface p-3 text-sm">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{tk('sources')}</div>
        <div className="grid gap-1 sm:grid-cols-2">
          <div>
            <span>{tk('candleProvider')}</span>: <span>{candlesQuery.data?.provider ?? unavailable}</span>
          </div>
          <div>
            <span>{tk('candleInterval')}</span>: <span>{candlesQuery.data?.interval ?? unavailable}</span>
          </div>
          <div>
            <span>{tk('latestCandleDate')}</span>: <span>{candlesQuery.data?.dataAsOf ?? unavailable}</span>
          </div>
          <div>
            <span>{tk('fetchedAt')}</span>: <span>{fetchedAt}</span>
          </div>
          {analysis && (
            <>
              <div>
                <span>{tk('analysisProvider')}</span>: <span>{analysis.provider}</span> · {analysis.interval}
              </div>
              <div>
                <span>{tk('analysisParameters')}</span>: <span>{tk('lookback')}</span>{' '}
                <span>{finiteNumber(lookback, 0)}</span>
              </div>
              <div>
                <span>{tk('minRr')}</span>: <span>{finiteNumber(minRr)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {analysis && <div className="rounded-lg border border-warning/60 bg-warning/10 p-3 text-sm font-medium text-warning">
        {tk('approximateLimitation')}
      </div>}

      {candlesQuery.data && !candlesQuery.isError && (
        <div data-testid="volume-zone-chart">
          <Suspense fallback={<ChartLoadingFallback />}>
            <CandleChart
              ticker={normalizedTicker}
              bars={candlesQuery.data?.priceHistory ?? []}
              patterns={candlesQuery.data?.patterns ?? []}
              entryPrice={analysis?.tradePlan.entry ?? null}
              stopPrice={analysis?.tradePlan.stop ?? null}
              targetPrice={analysis?.tradePlan.target ?? null}
              volumeZones={zones}
              showVolumeZones
            />
          </Suspense>
        </div>
      )}

      {analysis && <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <div className="p-3 text-xs font-semibold uppercase tracking-wide text-muted">{tk('zones')}</div>
        <table className="w-full text-left text-sm">
          <thead className="border-y border-border text-xs text-muted">
            <tr>
              <th className="px-3 py-2">{tk('zoneKind')}</th>
              <th className="px-3 py-2">{tk('zoneRole')}</th>
              <th className="px-3 py-2">{tk('zonePrice')}</th>
              <th className="px-3 py-2">{tk('zoneShare')}</th>
            </tr>
          </thead>
          <tbody>
            {analysis.volumeZones.map((zone, index) => (
              <tr className="border-b border-border last:border-0" key={`${zone.kind}-${zone.center}-${index}`}>
                <td className="px-3 py-2 uppercase">{valueLabel(zone.kind)}</td>
                <td className="px-3 py-2">{valueLabel(zone.role)}</td>
                <td className="px-3 py-2 tabular-nums">{finiteNumber(zone.center)}</td>
                <td className="px-3 py-2 tabular-nums">{typeof zone.volumeShare === 'number' && Number.isFinite(zone.volumeShare) ? `${formatNumber(zone.volumeShare * 100, 1)}%` : unavailable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {analysis && <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-1 text-xs font-semibold text-muted">{tk('rationale')}</div>
        <ul className="list-disc pl-5 text-sm">
          {analysis.rationale.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>}

      {analysis && analysis.warnings.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          {analysis.warnings.map((warning, i) => (
            <div key={i}>{warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
