import { useState, type ReactNode } from 'react';

import Button from '@/components/common/Button';
import { usePositionReviewMutation } from '@/features/intelligence/hooks';
import type { PositionReview } from '@/features/intelligence/positionReviewTypes';
import type { PositionWithMetrics } from '@/features/portfolio/api';

interface PositionReviewPanelProps {
  ticker: string;
  position?: PositionWithMetrics | null;
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return value.toFixed(digits);
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ReviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ReviewResult({ review }: { review: PositionReview }) {
  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            {review.suggestedAction.replace(/_/g, ' ')} · thesis {formatLabel(review.thesisStatus)}
          </p>
          <span className="text-xs text-muted">{new Date(review.generatedAt).toLocaleString()}</span>
        </div>
        <p className="mt-2 text-sm text-muted">{review.narrative}</p>
      </div>

      <ReviewCard title="Why it moved">
        <p className="text-sm text-foreground">{review.moveExplanation.summary}</p>
        {review.moveExplanation.drivers.length > 0 && (
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {review.moveExplanation.drivers.map((driver) => (
              <li key={driver}>• {driver}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <ReviewMetric label="Company" value={`${review.moveExplanation.companyCatalystWeight}%`} />
          <ReviewMetric label="Technical" value={`${review.moveExplanation.technicalWeight}%`} />
          <ReviewMetric label="Macro" value={`${review.moveExplanation.marketMacroWeight}%`} />
          <ReviewMetric label="Sector" value={`${review.moveExplanation.sectorWeight}%`} />
        </div>
      </ReviewCard>

      <div className="grid gap-3 md:grid-cols-2">
        <ReviewCard title="Protect profit">
          <div className="grid gap-2 sm:grid-cols-3">
            <ReviewMetric label="Current R" value={review.profitProtection.currentR == null ? 'N/A' : `${formatNumber(review.profitProtection.currentR)}R`} />
            <ReviewMetric label="Extension" value={formatLabel(review.profitProtection.moveExtension)} />
            <ReviewMetric label="Trim" value={formatLabel(review.profitProtection.trimAdvice)} />
          </div>
          <p className="mt-3 text-sm text-muted">{review.profitProtection.reason}</p>
        </ReviewCard>

        <ReviewCard title="Stop advice">
          <div className="grid gap-2 sm:grid-cols-3">
            <ReviewMetric label="Current" value={formatNumber(review.stopAdvice.currentStop)} />
            <ReviewMetric label="Suggested" value={formatNumber(review.stopAdvice.suggestedStop)} />
            <ReviewMetric label="Method" value={formatLabel(review.stopAdvice.method)} />
          </div>
          <p className="mt-3 text-sm text-muted">{review.stopAdvice.reason}</p>
        </ReviewCard>
      </div>

      <ReviewCard title="Macro/geopolitical overlay">
        <div className="grid gap-2 sm:grid-cols-3">
          <ReviewMetric label="Risk" value={formatLabel(review.macroOverlay.riskLevel)} />
          <ReviewMetric label="Technical reliability" value={formatLabel(review.macroOverlay.technicalReliability)} />
          <ReviewMetric label="Timeframe" value={formatLabel(review.macroOverlay.affectedTimeframe)} />
        </div>
        <p className="mt-3 text-sm text-muted">{review.macroOverlay.reason}</p>
      </ReviewCard>

      <ReviewCard title="Evidence used">
        {review.evidenceUsed.length > 0 ? (
          <div className="grid gap-2">
            {review.evidenceUsed.map((item) => (
              <div key={`${item.label}-${item.url ?? ''}`} className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="font-medium text-foreground underline">
                    {item.label}
                  </a>
                ) : (
                  <p className="font-medium text-foreground">{item.label}</p>
                )}
                <p className="mt-1 text-xs text-muted">
                  {[item.source, item.date, item.relevance].filter(Boolean).join(' · ')}
                </p>
                {item.summary && <p className="mt-1 text-sm text-muted">{item.summary}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No refreshed evidence returned by configured sources.</p>
        )}
      </ReviewCard>
    </div>
  );
}

export default function PositionReviewPanel({ ticker, position = null }: PositionReviewPanelProps) {
  const [refreshSources, setRefreshSources] = useState(false);
  const mutation = usePositionReviewMutation();
  const isHeld = Boolean(position?.positionId);

  const handleRun = () => {
    mutation.mutate({
      ticker,
      positionId: position?.positionId ?? null,
      refreshSources,
    });
  };

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Manual position review</p>
          <p className="mt-1 text-xs text-muted">
            Explain the move, protect open profit, adjust stop logic, and check macro/geopolitical overrides.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={handleRun} disabled={mutation.isPending}>
          {mutation.isPending ? 'Reviewing...' : isHeld ? 'Run position review' : 'Run symbol review'}
        </Button>
      </div>
      <div className="px-3 py-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={refreshSources}
            disabled={mutation.isPending}
            onChange={(event) => setRefreshSources(event.target.checked)}
          />
          Refresh app sources first
        </label>
        {mutation.isError && (
          <p className="mt-2 text-sm text-danger">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to run position review'}
          </p>
        )}
        {mutation.data ? (
          <div className="mt-3">
            <ReviewResult review={mutation.data} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Run this manually when you want to understand an intraday move, protect a winner, or reassess the thesis.
          </p>
        )}
      </div>
    </section>
  );
}
