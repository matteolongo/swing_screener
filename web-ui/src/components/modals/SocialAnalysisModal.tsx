import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { analyzeSocial } from '@/features/social/api';
import { SocialAnalysisResponse } from '@/features/social/types';
import { formatDateTime } from '@/utils/formatters';
import { t } from '@/i18n/t';

const STATUS_VARIANTS: Record<SocialAnalysisResponse['status'], 'success' | 'warning' | 'error' | 'default'> = {
  ok: 'success',
  no_data: 'warning',
  error: 'error',
};

export default function SocialAnalysisModal({
  symbol,
  onClose,
}: {
  symbol: string;
  onClose: () => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [lookbackInput, setLookbackInput] = useState('');

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const trimmed = lookbackInput.trim();
      let lookbackHours: number | undefined;
      
      if (trimmed !== '') {
        const parsed = parseInt(trimmed, 10);
        // Only include if it's a valid positive integer
        if (Number.isFinite(parsed) && parsed > 0) {
          lookbackHours = parsed;
        }
      }
      
      return analyzeSocial({
        symbol,
        maxEvents: 100,
        lookbackHours,
      });
    },
  });

  useEffect(() => {
    setShowRaw(false);
    setLookbackInput('');
    analysisMutation.mutate();
  }, [symbol]);

  const data = analysisMutation.data;
  const status = data?.status ?? (analysisMutation.isError ? 'error' : 'no_data');
  const statusVariant = STATUS_VARIANTS[status];
  const statusLabel =
    status === 'ok'
      ? t('socialAnalysisModal.status.ok')
      : status === 'no_data'
        ? t('socialAnalysisModal.status.noData')
        : t('socialAnalysisModal.status.error');

  const lastExecution = data?.lastExecutionAt
    ? formatDateTime(data.lastExecutionAt)
    : t('common.placeholders.emDash');
  const sampleSize = data?.sampleSize ?? 0;
  const reasons = data?.reasons ?? [];
  const defaultLookback = data?.lookbackHours;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card variant="elevated" className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{t('socialAnalysisModal.title', { symbol })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
            <div className="text-xs text-gray-500">{t('socialAnalysisModal.lastExecution', { value: lastExecution })}</div>
          </div>

          {analysisMutation.isPending && (
            <div className="text-sm text-gray-600">{t('socialAnalysisModal.running')}</div>
          )}

          {analysisMutation.isError && (
            <div className="text-sm text-red-600">
              {(analysisMutation.error as Error).message}
            </div>
          )}

          {data && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-2 text-sm">
                <div className="flex-1">
                  <label className="block text-gray-500 mb-1" htmlFor="lookbackHoursInput">
                    {t('socialAnalysisModal.lookbackOverride')}
                  </label>
                  <input
                    id="lookbackHoursInput"
                    type="number"
                    min={1}
                    placeholder={
                      defaultLookback
                        ? t('socialAnalysisModal.lookbackPlaceholder', { value: defaultLookback })
                        : t('socialAnalysisModal.lookbackPlaceholderFallback')
                    }
                    value={lookbackInput}
                    onChange={(event) => setLookbackInput(event.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {defaultLookback
                    ? t('socialAnalysisModal.currentDefault', { value: defaultLookback })
                    : t('socialAnalysisModal.currentDefaultFallback')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">{t('socialAnalysisModal.metrics.sentiment')}</div>
                  <div className="font-semibold">
                    {data.sentimentScore != null
                      ? data.sentimentScore.toFixed(2)
                      : t('common.placeholders.emDash')}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">{t('socialAnalysisModal.metrics.confidence')}</div>
                  <div className="font-semibold">
                    {data.sentimentConfidence != null
                      ? data.sentimentConfidence.toFixed(2)
                      : t('common.placeholders.emDash')}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">{t('socialAnalysisModal.metrics.sampleSize')}</div>
                  <div className="font-semibold">{sampleSize}</div>
                </div>
                <div>
                  <div className="text-gray-500">{t('socialAnalysisModal.metrics.attentionZ')}</div>
                  <div className="font-semibold">
                    {data.attentionZ != null
                      ? data.attentionZ.toFixed(2)
                      : t('common.placeholders.emDash')}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">{t('socialAnalysisModal.metrics.hype')}</div>
                  <div className="font-semibold">
                    {data.hypeScore != null
                      ? data.hypeScore.toFixed(2)
                      : t('common.placeholders.emDash')}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">{t('socialAnalysisModal.metrics.lookbackHours')}</div>
                  <div className="font-semibold">{data.lookbackHours}</div>
                </div>
              </div>

              {status === 'no_data' && (
                <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                  {t('socialAnalysisModal.noDataMessage')}
                </div>
              )}

              {reasons.length > 0 && (
                <div className="text-xs text-gray-600">
                  {t('socialAnalysisModal.reasonsPrefix', { reasons: reasons.join(', ') })}
                </div>
              )}

              {data.error && (
                <div className="text-sm text-red-600">
                  {t('socialAnalysisModal.errorPrefix', { message: data.error })}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{t('socialAnalysisModal.rawEventsTitle', { count: data.rawEvents.length })}</div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowRaw((prev) => !prev)}
                >
                  {showRaw ? t('socialAnalysisModal.toggleHide') : t('socialAnalysisModal.toggleShow')}
                </Button>
              </div>

              {showRaw && (
                <div className="max-h-64 overflow-auto space-y-3 text-sm">
                  {data.rawEvents.length === 0 ? (
                    <div className="text-gray-500">{t('socialAnalysisModal.noEvents')}</div>
                  ) : (
                    data.rawEvents.map((ev, idx) => {
                      const subreddit = typeof ev.metadata?.subreddit === 'string' ? ev.metadata.subreddit : null;
                      return (
                        <div key={`${ev.symbol}-${idx}`} className="border border-gray-200 rounded p-2">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <div>
                              {formatDateTime(ev.timestamp)}
                              {subreddit ? ` · r/${subreddit}` : ''}
                            </div>
                            {ev.upvotes != null && <div>▲ {ev.upvotes}</div>}
                          </div>
                          <div className="text-gray-700">
                            {ev.text.length > 300 ? `${ev.text.slice(0, 300)}...` : ev.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('common.actions.close')}
            </Button>
            <Button
              variant="primary"
              onClick={() => analysisMutation.mutate()}
              disabled={analysisMutation.isPending}
            >
              {analysisMutation.isPending ? t('socialAnalysisModal.refreshing') : t('common.actions.refresh')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
