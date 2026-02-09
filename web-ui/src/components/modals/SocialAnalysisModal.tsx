import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { SocialAnalysisResponse, SocialAnalysisResponseAPI, transformSocialAnalysisResponse } from '@/types/social';
import { formatDateTime } from '@/utils/formatters';

const STATUS_LABELS: Record<SocialAnalysisResponse['status'], { label: string; variant: 'success' | 'warning' | 'error' | 'default' } > = {
  ok: { label: 'OK', variant: 'success' },
  no_data: { label: 'No Data', variant: 'warning' },
  error: { label: 'Error', variant: 'error' },
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
      let lookback_hours: number | undefined;
      
      if (trimmed !== '') {
        const parsed = parseInt(trimmed, 10);
        // Only include if it's a valid positive integer
        if (Number.isFinite(parsed) && parsed > 0) {
          lookback_hours = parsed;
        }
      }
      
      const payload: { symbol: string; max_events: number; lookback_hours?: number } = {
        symbol,
        max_events: 100,
      };
      if (lookback_hours !== undefined) {
        payload.lookback_hours = lookback_hours;
      }

      const response = await fetch(apiUrl(API_ENDPOINTS.socialAnalyze), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to analyze sentiment');
      }
      const data: SocialAnalysisResponseAPI = await response.json();
      return transformSocialAnalysisResponse(data);
    },
  });

  useEffect(() => {
    setShowRaw(false);
    setLookbackInput('');
    analysisMutation.mutate();
  }, [symbol]);

  const data = analysisMutation.data;
  const status = data?.status ?? (analysisMutation.isError ? 'error' : 'no_data');
  const statusBadge = STATUS_LABELS[status];

  const lastExecution = data?.lastExecutionAt ? formatDateTime(data.lastExecutionAt) : '—';
  const sampleSize = data?.sampleSize ?? 0;
  const reasons = data?.reasons ?? [];
  const defaultLookback = data?.lookbackHours;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card variant="elevated" className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Sentiment Analysis - {symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            <div className="text-xs text-gray-500">Last execution: {lastExecution}</div>
          </div>

          {analysisMutation.isPending && (
            <div className="text-sm text-gray-600">Running analysis...</div>
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
                    Lookback Override (hours)
                  </label>
                  <input
                    id="lookbackHoursInput"
                    type="number"
                    min={1}
                    placeholder={defaultLookback ? `Default: ${defaultLookback}` : 'Use strategy default'}
                    value={lookbackInput}
                    onChange={(event) => setLookbackInput(event.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {defaultLookback ? `Current default: ${defaultLookback}h` : 'Default from strategy'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Sentiment</div>
                  <div className="font-semibold">
                    {data.sentimentScore != null ? data.sentimentScore.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Confidence</div>
                  <div className="font-semibold">
                    {data.sentimentConfidence != null ? data.sentimentConfidence.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Sample Size</div>
                  <div className="font-semibold">{sampleSize}</div>
                </div>
                <div>
                  <div className="text-gray-500">Attention Z</div>
                  <div className="font-semibold">
                    {data.attentionZ != null ? data.attentionZ.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Hype</div>
                  <div className="font-semibold">
                    {data.hypeScore != null ? data.hypeScore.toFixed(2) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Lookback (hours)</div>
                  <div className="font-semibold">{data.lookbackHours}</div>
                </div>
              </div>

              {status === 'no_data' && (
                <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                  Not enough data for sentiment thresholds, but raw events are available below.
                </div>
              )}

              {reasons.length > 0 && (
                <div className="text-xs text-gray-600">
                  Reasons: {reasons.join(', ')}
                </div>
              )}

              {data.error && (
                <div className="text-sm text-red-600">
                  Error: {data.error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Raw Events ({data.rawEvents.length})</div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowRaw((prev) => !prev)}
                >
                  {showRaw ? 'Hide' : 'Show'}
                </Button>
              </div>

              {showRaw && (
                <div className="max-h-64 overflow-auto space-y-3 text-sm">
                  {data.rawEvents.length === 0 ? (
                    <div className="text-gray-500">No events found in lookback window.</div>
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
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => analysisMutation.mutate()}
              disabled={analysisMutation.isPending}
            >
              {analysisMutation.isPending ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
