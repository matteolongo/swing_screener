import { useEffect, useMemo, useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { t } from '@/i18n/t';
import {
  buildIndicatorPreviewViewModel,
  type IndicatorPreviewInput,
  type IndicatorPreviewPoint,
} from '@/features/strategy/indicatorPreview';

interface IndicatorPreviewCardProps {
  input: IndicatorPreviewInput;
}

const PREVIEW_WIDTH = 560;
const PREVIEW_HEIGHT = 220;
const PREVIEW_PADDING_X = 20;
const PREVIEW_PADDING_Y = 16;
const DEBOUNCE_MS = 120;

function buildPolyline(points: IndicatorPreviewPoint[], getValue: (point: IndicatorPreviewPoint) => number | null, minY: number, maxY: number): string {
  const validPoints = points
    .map((point, index) => ({ index, value: getValue(point) }))
    .filter((item): item is { index: number; value: number } => typeof item.value === 'number' && Number.isFinite(item.value));

  if (validPoints.length < 2) {
    return '';
  }

  const usableWidth = PREVIEW_WIDTH - PREVIEW_PADDING_X * 2;
  const usableHeight = PREVIEW_HEIGHT - PREVIEW_PADDING_Y * 2;
  const valueRange = maxY - minY || 1;

  return validPoints
    .map(({ index, value }) => {
      const x = PREVIEW_PADDING_X + (index / (points.length - 1)) * usableWidth;
      const yRatio = (value - minY) / valueRange;
      const y = PREVIEW_HEIGHT - PREVIEW_PADDING_Y - yRatio * usableHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function collectValues(points: IndicatorPreviewPoint[]): number[] {
  return points.flatMap((point) => [
    point.close,
    point.smaFast,
    point.smaMid,
    point.smaLong,
    point.pullbackMa,
    point.breakoutHigh,
  ]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

export default function IndicatorPreviewCard({ input }: IndicatorPreviewCardProps) {
  const [debouncedInput, setDebouncedInput] = useState(input);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedInput(input);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [input]);

  const preview = useMemo(() => buildIndicatorPreviewViewModel(debouncedInput), [debouncedInput]);

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>{t('strategyPage.indicatorPreview.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t('strategyPage.indicatorPreview.description')}
        </p>

        {!preview.isValid ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            {t('strategyPage.indicatorPreview.invalid')} {preview.errorMessage}
          </div>
        ) : (() => {
          const values = collectValues(preview.points);
          const minValue = Math.min(...values);
          const maxValue = Math.max(...values);

          return (
            <>
              <div className="overflow-x-auto">
                <svg
                  viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
                  className="h-[220px] min-w-[560px] w-full rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                  role="img"
                  aria-label={t('strategyPage.indicatorPreview.aria')}
                >
                  <polyline
                    points={buildPolyline(preview.points, (point) => point.close, minValue, maxValue)}
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={buildPolyline(preview.points, (point) => point.smaFast, minValue, maxValue)}
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={buildPolyline(preview.points, (point) => point.smaMid, minValue, maxValue)}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={buildPolyline(preview.points, (point) => point.smaLong, minValue, maxValue)}
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={buildPolyline(preview.points, (point) => point.pullbackMa, minValue, maxValue)}
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={buildPolyline(preview.points, (point) => point.breakoutHigh, minValue, maxValue)}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>

              <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-300 md:grid-cols-2">
                <div>{t('strategyPage.indicatorPreview.latest.close', { value: preview.latestClose.toFixed(2) })}</div>
                <div>{t('strategyPage.indicatorPreview.latest.breakout', { value: preview.latestBreakoutHigh.toFixed(2) })}</div>
                <div>{t('strategyPage.indicatorPreview.latest.pullback', { value: preview.latestPullbackMa.toFixed(2) })}</div>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-700 dark:text-gray-200">
                <span>{t('strategyPage.indicatorPreview.legend.close')}</span>
                <span>{t('strategyPage.indicatorPreview.legend.smaFast')}</span>
                <span>{t('strategyPage.indicatorPreview.legend.smaMid')}</span>
                <span>{t('strategyPage.indicatorPreview.legend.smaLong')}</span>
                <span>{t('strategyPage.indicatorPreview.legend.pullback')}</span>
                <span>{t('strategyPage.indicatorPreview.legend.breakout')}</span>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('strategyPage.indicatorPreview.disclaimer')}
              </p>
            </>
          );
        })()}
      </CardContent>
    </Card>
  );
}
