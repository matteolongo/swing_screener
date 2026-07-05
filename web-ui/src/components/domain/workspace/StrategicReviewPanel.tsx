import { useState } from 'react';

import Button from '@/components/common/Button';
import { useStrategicReviewMutation } from '@/features/intelligence/hooks';
import type { StrategicReview, StrategicSituation } from '@/features/intelligence/strategicReviewTypes';
import { t } from '@/i18n/t';

const I18N_PREFIX = 'workspacePage.panels.analysis.intelligence.strategic';

interface StrategicReviewPanelProps {
  ticker: string;
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').toLowerCase();
}

function SituationCard({ situation }: { situation: StrategicSituation }) {
  const prediction = situation.predictions[0] ?? null;
  return (
    <article className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{situation.title}</h3>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase tracking-wide text-muted">
          {situation.stage}
        </span>
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
              <li key={item}>• {item}</li>
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
            <div key={`${action.actionType}-${action.title}`} className="rounded-md border border-border bg-surface px-3 py-2">
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
  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{t(`${I18N_PREFIX}.title`)}</p>
          <span className="text-xs text-muted">{new Date(review.generatedAt).toLocaleString()}</span>
        </div>
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
  const [topic, setTopic] = useState('');
  const mutation = useStrategicReviewMutation();

  const handleRun = () => {
    mutation.mutate({
      ticker,
      topic: topic.trim() || null,
      refreshSources,
      riskMode,
      horizonDays: 10,
    });
  };

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`${I18N_PREFIX}.title`)}</p>
          <p className="mt-1 text-xs text-muted">{t(`${I18N_PREFIX}.description`)}</p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={handleRun} disabled={mutation.isPending}>
          {mutation.isPending ? t(`${I18N_PREFIX}.runningAction`) : t(`${I18N_PREFIX}.runAction`)}
        </Button>
      </div>

      <div className="grid gap-3 px-3 py-3">
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <label className="grid gap-1 text-xs text-muted">
            {t(`${I18N_PREFIX}.topicLabel`)}
            <input
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              value={topic}
              disabled={mutation.isPending}
              onChange={(event) => setTopic(event.target.value)}
              placeholder={t(`${I18N_PREFIX}.topicPlaceholder`)}
            />
          </label>

          <label className="grid gap-1 text-xs text-muted">
            {t(`${I18N_PREFIX}.riskModeLabel`)}
            <select
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              value={riskMode}
              disabled={mutation.isPending}
              onChange={(event) => setRiskMode(event.target.value as typeof riskMode)}
            >
              <option value="normal">{t(`${I18N_PREFIX}.riskMode.normal`)}</option>
              <option value="defensive">{t(`${I18N_PREFIX}.riskMode.defensive`)}</option>
              <option value="aggressive">{t(`${I18N_PREFIX}.riskMode.aggressive`)}</option>
            </select>
          </label>

          <label className="flex items-end gap-2 pb-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={refreshSources}
              disabled={mutation.isPending}
              onChange={(event) => setRefreshSources(event.target.checked)}
            />
            {t(`${I18N_PREFIX}.refreshSources`)}
          </label>
        </div>

        {mutation.isError && (
          <p className="text-sm text-danger">
            {mutation.error instanceof Error ? mutation.error.message : t(`${I18N_PREFIX}.runError`)}
          </p>
        )}

        {mutation.data ? (
          <StrategicResult review={mutation.data} />
        ) : (
          <p className="text-sm text-muted">{t(`${I18N_PREFIX}.idle`)}</p>
        )}
      </div>
    </section>
  );
}
