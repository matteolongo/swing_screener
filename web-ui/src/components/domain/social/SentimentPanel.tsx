import { useState } from 'react';
import { SocialAnalysisResponse, SocialRawEvent } from '@/types/social';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';

interface SentimentPanelProps {
  data: SocialAnalysisResponse | null;
  loading?: boolean;
  error?: string;
}

function SentimentScore({ score, confidence }: { score?: number; confidence?: number }) {
  if (score === undefined || score === null) {
    return <span className="text-gray-500">N/A</span>;
  }

  const getScoreColor = (s: number) => {
    if (s > 0.3) return 'text-green-600 dark:text-green-400';
    if (s < -0.3) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getScoreLabel = (s: number) => {
    if (s > 0.5) return 'Very Positive';
    if (s > 0.2) return 'Positive';
    if (s > -0.2) return 'Neutral';
    if (s > -0.5) return 'Negative';
    return 'Very Negative';
  };

  return (
    <div className="space-y-1">
      <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
        {score.toFixed(2)}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {getScoreLabel(score)}
      </div>
      {confidence !== undefined && (
        <div className="text-xs text-gray-500 dark:text-gray-500">
          Confidence: {(confidence * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
}

function EventsList({ events }: { events: SocialRawEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayEvents = expanded ? events : events.slice(0, 5);

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No events found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayEvents.map((event, idx) => (
        <div
          key={idx}
          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge variant="default" size="sm">
              {event.source === 'yahoo_finance' ? 'Yahoo Finance' : 'Reddit'}
            </Badge>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(event.timestamp).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {event.text}
          </p>
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              View source →
            </a>
          )}
          {event.upvotes !== undefined && event.upvotes !== null && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-3">
              ↑ {event.upvotes}
            </span>
          )}
        </div>
      ))}
      
      {events.length > 5 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          {expanded ? 'Show Less' : `Show More (${events.length - 5} more)`}
        </Button>
      )}
    </div>
  );
}

export default function SentimentPanel({ data, loading, error }: SentimentPanelProps) {
  const [showEvents, setShowEvents] = useState(false);

  if (loading) {
    return (
      <Card variant="bordered">
        <CardContent>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Loading sentiment data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="bordered">
        <CardContent>
          <div className="text-center py-8 text-red-600 dark:text-red-400">
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card variant="bordered">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Sentiment Analysis - {data.symbol}</CardTitle>
          <div className="flex items-center gap-2">
            {data.providers.map(p => (
              <Badge key={p} variant="default" size="sm">
                {p === 'yahoo_finance' ? 'Yahoo Finance' : 'Reddit'}
              </Badge>
            ))}
            <Badge variant="info" size="sm">
              {data.sentimentAnalyzer}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sentiment</div>
              <SentimentScore 
                score={data.sentimentScore} 
                confidence={data.sentimentConfidence}
              />
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Sample Size</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {data.sampleSize}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Attention</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {data.attentionScore.toFixed(1)}
              </div>
              {data.attentionZ !== undefined && (
                <div className="text-xs text-gray-500">Z-score: {data.attentionZ.toFixed(2)}</div>
              )}
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</div>
              <Badge 
                variant={data.status === 'ok' ? 'success' : data.status === 'no_data' ? 'warning' : 'error'}
              >
                {data.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Source Breakdown */}
          {Object.keys(data.sourceBreakdown).length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Source Breakdown
              </div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(data.sourceBreakdown).map(([source, count]) => (
                  <Badge key={source} variant="default">
                    {source === 'yahoo_finance' ? 'Yahoo Finance' : 'Reddit'}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Reasons/Warnings */}
          {data.reasons.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                Warnings
              </div>
              <ul className="text-sm text-yellow-800 dark:text-yellow-200 list-disc list-inside">
                {data.reasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Raw Events Toggle */}
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEvents(!showEvents)}
              className="w-full"
            >
              {showEvents ? 'Hide' : 'Show'} Raw Events ({data.rawEvents.length})
            </Button>
          </div>

          {/* Collapsible Events List */}
          {showEvents && (
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Recent Events
              </div>
              <EventsList events={data.rawEvents} />
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>Lookback: {data.lookbackHours} hours</div>
            <div>Last updated: {new Date(data.lastExecutionAt).toLocaleString()}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
