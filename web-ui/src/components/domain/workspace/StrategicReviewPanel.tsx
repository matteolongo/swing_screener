import { useEffect, useMemo, useState } from 'react';

import Button from '@/components/common/Button';
import { useStrategicReviewMutation } from '@/features/intelligence/hooks';
import type { StrategicDirection, StrategicReview, StrategicSituation } from '@/features/intelligence/strategicReviewTypes';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

const I18N_PREFIX = 'workspacePage.panels.analysis.intelligence.strategic';

interface StrategicReviewPanelProps {
  ticker: string;
}

const WATCH_AREAS = [
  { id: 'macro', labelKey: 'watchArea.macro' },
  { id: 'geopolitics', labelKey: 'watchArea.geopolitics' },
  { id: 'earnings', labelKey: 'watchArea.earnings' },
  { id: 'sector_rotation', labelKey: 'watchArea.sectorRotation' },
] as const;

type WatchAreaId = (typeof WATCH_AREAS)[number]['id'];

const DEFAULT_WATCH_AREAS: WatchAreaId[] = ['macro', 'geopolitics', 'earnings'];

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').toLowerCase();
}

function directionTone(direction: StrategicDirection | null) {
  switch (direction) {
    case 'bullish':
      return {
        label: t(`${I18N_PREFIX}.signal.bullish`),
        ariaLabel: 'Bullish strategic signal',
        border: 'border-l-success',
        dot: 'bg-success',
        chip: 'border-success/40 bg-success/10 text-success',
        text: 'text-success',
      };
    case 'bearish':
      return {
        label: t(`${I18N_PREFIX}.signal.bearish`),
        ariaLabel: 'Bearish strategic signal',
        border: 'border-l-danger',
        dot: 'bg-danger',
        chip: 'border-danger/40 bg-danger/10 text-danger',
        text: 'text-danger',
      };
    case 'mixed':
      return {
        label: t(`${I18N_PREFIX}.signal.mixed`),
        ariaLabel: 'Mixed strategic signal',
        border: 'border-l-primary',
        dot: 'bg-primary',
        chip: 'border-primary/40 bg-primary/10 text-primary',
        text: 'text-primary',
      };
    default:
      return {
        label: t(`${I18N_PREFIX}.signal.neutral`),
        ariaLabel: 'Neutral strategic signal',
        border: 'border-l-border',
        dot: 'bg-muted',
        chip: 'border-border bg-surface text-muted',
        text: 'text-muted',
      };
  }
}

function SituationCard({ situation }: { situation: StrategicSituation }) {
  const prediction = situation.predictions[0] ?? null;
  const tone = directionTone(prediction?.direction ?? 'neutral');
  return (
    <article className={cn('rounded-lg border border-l-4 border-border bg-background/40 p-3', tone.border)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-label={tone.ariaLabel} className={cn('h-2.5 w-2.5 rounded-full', tone.dot)} />
          <h3 className="text-sm font-semibold text-foreground">{situation.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide', tone.chip)}>
            {tone.label}
          </span>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
            {situation.stage}
          </span>
        </div>
      </div>

      {situation.affectedSymbols.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {situation.affectedSymbols.map((symbol) => (
            <span key={symbol} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {symbol}
            </span>
          ))}
        </div>
      )}

      {situation.whyNow.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t(`${I18N_PREFIX}.whyNow`)}</p>
          <ul className="mt-1 grid gap-1 text-sm text-muted">
            {situation.whyNow.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {prediction && (
        <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t(`${I18N_PREFIX}.predictionSummary`, {
              direction: formatLabel(prediction.direction),
              confidence: prediction.confidence,
              horizonDays: prediction.horizonDays,
            })}
          </p>
          <p className="mt-1 text-sm text-foreground">{prediction.thesis}</p>
          <p className="mt-1 text-xs text-muted">
            {t(`${I18N_PREFIX}.invalidationLabel`)}: {prediction.invalidation}
          </p>
        </div>
      )}

      {situation.actions.length > 0 && (
        <div className="mt-3 grid gap-2">
          {situation.actions.map((action) => (
            <div
              key={`${action.actionType}-${action.title}`}
              className={cn('rounded-md border border-l-4 border-border bg-surface px-3 py-2', tone.border)}
            >
              <p className="text-sm font-medium text-foreground">{action.title}</p>
              <p className="mt-1 text-xs text-muted">{action.rationale}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function StrategicResult({ review }: { review: StrategicReview }) {
  const primaryAction = review.situations.flatMap((situation) => situation.actions)[0] ?? null;
  const planImpact = (() => {
    switch (primaryAction?.actionType) {
      case 'WAIT_FOR_CONFIRMATION':
        return 'Wait for confirmation before changing the current plan.';
      case 'TIGHTEN_RISK_REVIEW':
        return 'Review whether the current risk limits still fit the context.';
      case 'REDUCE_EXPOSURE_REVIEW':
        return 'Review whether exposure needs to be reduced.';
      case 'REVIEW_CONTEXT':
        return 'Review the context before adding risk.';
      default:
        return 'No change identified — keep following the current trade decision.';
    }
  })();
  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Does this change the plan?</p>
          <span className="text-xs text-muted">{new Date(review.generatedAt).toLocaleString()}</span>
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">
          {planImpact}
        </p>
        <p className="mt-2 text-sm text-muted">{review.memo}</p>
        <p className="mt-1 text-xs text-muted">
          {t(`${I18N_PREFIX}.appContextOnly`, { count: review.externalSourceCount })}
        </p>
      </div>

      {review.situations.map((situation) => (
        <SituationCard key={situation.title} situation={situation} />
      ))}
    </div>
  );
}

export default function StrategicReviewPanel({ ticker }: StrategicReviewPanelProps) {
  const [refreshSources, setRefreshSources] = useState(false);
  const [riskMode, setRiskMode] = useState<'normal' | 'defensive' | 'aggressive'>('normal');
  const [watchAreas, setWatchAreas] = useState<WatchAreaId[]>(DEFAULT_WATCH_AREAS);
  const [topic, setTopic] = useState('');
  const mutation = useStrategicReviewMutation();
  const normalizedTicker = useMemo(() => ticker.trim().toUpperCase(), [ticker]);
  const mutationTicker = mutation.variables?.ticker?.trim().toUpperCase();
  const isCurrentMutation = !mutationTicker || mutationTicker === normalizedTicker;

  useEffect(() => {
    mutation.reset?.();
    setRefreshSources(false);
    setRiskMode('normal');
    setWatchAreas(DEFAULT_WATCH_AREAS);
    setTopic('');
  }, [normalizedTicker]);

  const handleRun = () => {
    const selectedWatchAreas = WATCH_AREAS.filter((area) => watchAreas.includes(area.id)).map((area) =>
      t(`${I18N_PREFIX}.${area.labelKey}`).toLowerCase()
    );
    const investigationTopic = topic.trim();
    const topicParts = [...selectedWatchAreas, ...(investigationTopic ? [investigationTopic] : [])];

    mutation.mutate({
      ticker: normalizedTicker,
      topic: topicParts.length > 0 ? topicParts.join(', ') : null,
      refreshSources,
      riskMode,
      horizonDays: 10,
    });
  };

  const toggleWatchArea = (id: WatchAreaId) => {
    setWatchAreas((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-3 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Market context check</p>
          <p className="mt-1 text-xs text-muted">
            Optional: use this when macro, news, sector rotation, or an event may change the timing of the current setup.
          </p>
        </div>
      </div>

      <div className="grid gap-3 px-3 py-3">
        <p className="text-sm text-muted">
          Default check: macro, geopolitics, and upcoming earnings. This is advisory context; it does not create an order.
        </p>

        <details className="rounded-md border border-border bg-background/30 p-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Customize check</summary>
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`${I18N_PREFIX}.watchListLabel`)}</p>
              <div className="flex flex-wrap gap-2">
                {WATCH_AREAS.map((area) => (
                  <label
                    key={area.id}
                    className={cn(
                      'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
                      watchAreas.includes(area.id)
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-surface text-muted'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={watchAreas.includes(area.id)}
                      disabled={isCurrentMutation && mutation.isPending}
                      onChange={() => toggleWatchArea(area.id)}
                    />
                    {t(`${I18N_PREFIX}.${area.labelKey}`)}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <label className="grid gap-1 text-xs text-muted">
                {t(`${I18N_PREFIX}.topicLabel`)}
                <input
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  value={topic}
                  disabled={isCurrentMutation && mutation.isPending}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder={t(`${I18N_PREFIX}.topicPlaceholder`)}
                />
              </label>

              <label className="grid gap-1 text-xs text-muted">
                {t(`${I18N_PREFIX}.riskModeLabel`)}
                <select
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  value={riskMode}
                  disabled={isCurrentMutation && mutation.isPending}
                  onChange={(event) => setRiskMode(event.target.value as typeof riskMode)}
                >
                  <option value="normal">{t(`${I18N_PREFIX}.riskMode.normal`)}</option>
                  <option value="defensive">{t(`${I18N_PREFIX}.riskMode.defensive`)}</option>
                  <option value="aggressive">{t(`${I18N_PREFIX}.riskMode.aggressive`)}</option>
                </select>
              </label>
            </div>
          </div>
        </details>

        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={refreshSources}
            disabled={isCurrentMutation && mutation.isPending}
            onChange={(event) => setRefreshSources(event.target.checked)}
          />
          Use latest sources (slower)
        </label>

        <Button type="button" size="sm" variant="secondary" onClick={handleRun} disabled={isCurrentMutation && mutation.isPending}>
          {isCurrentMutation && mutation.isPending ? 'Checking market context…' : 'Check market context'}
        </Button>

        {isCurrentMutation && mutation.isError && (
          <p className="text-sm text-danger">
            {mutation.error instanceof Error ? mutation.error.message : t(`${I18N_PREFIX}.runError`)}
          </p>
        )}

        {isCurrentMutation && mutation.data ? (
          <StrategicResult review={mutation.data} />
        ) : (
          <p className="text-sm text-muted">{t(`${I18N_PREFIX}.idle`)}</p>
        )}
      </div>
    </section>
  );
}
