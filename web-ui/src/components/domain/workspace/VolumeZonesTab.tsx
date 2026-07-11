import { lazy, Suspense, useMemo } from 'react';
import type { ChartVolumeZone } from '@/components/domain/market/CandleChart';
import { useTickerCandles } from '@/features/screener/hooks';
import { useVolumeAnalysisQuery } from '@/features/volumeZones/hooks';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

const K = 'workspacePage.panels.analysis.volumeZones';
const tk = (leaf: string) => t(`${K}.${leaf}` as MessageKey);
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

export default function VolumeZonesTab({ ticker }: { ticker: string }) {
  const analysisQuery = useVolumeAnalysisQuery(ticker);
  const candlesQuery = useTickerCandles(ticker);

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

  if (analysisQuery.isLoading) {
    return <div className="text-sm text-muted">{tk('loading')}</div>;
  }
  if (analysisQuery.isError || !analysis) {
    return <div className="text-sm text-danger">{tk('loadError')}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-lg font-semibold">{analysis.action}</span>
          <span>
            {tk('bias')}: {analysis.marketBias}
          </span>
          <span>
            {tk('setup')}: {analysis.setupType || tk('noSetup')}
          </span>
          <span>
            <span>{tk('confidence')}</span>: {analysis.confidenceScore}
          </span>
        </div>
        {analysis.tradePlan.entry != null && (
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
            <span>
              {tk('entry')}: {analysis.tradePlan.entry}
            </span>
            <span>
              {tk('stop')}: {analysis.tradePlan.stop}
            </span>
            <span>
              {tk('target')}: {analysis.tradePlan.target}
            </span>
            <span>
              {tk('rr')}: {analysis.tradePlan.rr?.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <Suspense fallback={<ChartLoadingFallback />}>
        <CandleChart
          ticker={ticker}
          bars={candlesQuery.data?.priceHistory ?? []}
          patterns={candlesQuery.data?.patterns ?? []}
          entryPrice={analysis.tradePlan.entry ?? null}
          stopPrice={analysis.tradePlan.stop ?? null}
          targetPrice={analysis.tradePlan.target ?? null}
          volumeZones={zones}
          showVolumeZones
        />
      </Suspense>

      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="mb-1 text-xs font-semibold text-muted">{tk('rationale')}</div>
        <ul className="list-disc pl-5 text-sm">
          {analysis.rationale.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      {analysis.warnings.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          {analysis.warnings.map((warning, i) => (
            <div key={i}>{warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
