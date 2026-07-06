import { useEffect, useState } from 'react';

import Badge from '@/components/common/Badge';
import { useRunTrace } from '@/features/intelligence/hooks';
import type { RunTrace, StepTrace } from '@/features/intelligence/traceTypes';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

type DetailTab = 'data' | 'sources' | 'prompt' | 'model' | 'errors';

const KEY = 'workspacePage.panels.analysis.intelligence.agentTrace';

const STEP_NAMES = [
  'enrich_request',
  'enrich_technicals',
  'enrich_polygon',
  'resolve_context',
  'assemble_inputs',
  'build_prompt',
  'search',
  'format',
  'postprocess',
  'weigh_evidence',
  'assemble_result',
  'persist',
] as const;
type StepName = (typeof STEP_NAMES)[number];

// Backend step identifiers are shown to the user, so map them to friendly labels;
// an unrecognised name falls back to the raw identifier rather than a missing-key string.
function stepLabel(name: string): string {
  if ((STEP_NAMES as readonly string[]).includes(name)) {
    return t(`${KEY}.stepLabels.${name as StepName}` as `${typeof KEY}.stepLabels.${StepName}`);
  }
  return name;
}

function formatDuration(ms: number): string {
  if (ms < 1) return t(`${KEY}.subMs`);
  if (ms >= 1000) return t(`${KEY}.seconds`, { s: (ms / 1000).toFixed(1) });
  return t(`${KEY}.duration`, { ms: Math.round(ms) });
}

// Only surface a detail tab when the selected step actually carries that data, so
// steps don't read as "broken" behind a row of empty placeholders.
function availableTabs(step: StepTrace): DetailTab[] {
  const tabs: DetailTab[] = [];
  if (Object.keys(step.outputsSummary ?? {}).length > 0) tabs.push('data');
  if (step.sourceCounts && Object.keys(step.sourceCounts).length > 0) tabs.push('sources');
  if (step.promptHash) tabs.push('prompt');
  if (step.model != null || step.tokens != null) tabs.push('model');
  if (step.error) tabs.push('errors');
  return tabs;
}

function StepDetail({ step }: { step: StepTrace }) {
  const tabs = availableTabs(step);
  const [tab, setTab] = useState<DetailTab>(tabs[0] ?? 'data');

  if (tabs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
        {t(`${KEY}.onlyTiming`)}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap gap-1 border-b border-border pb-2" role="tablist">
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === id ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground',
            )}
          >
            {t(`${KEY}.tabs.${id}` as `${typeof KEY}.tabs.${DetailTab}`)}
          </button>
        ))}
      </div>

      <div className="mt-3 text-sm">
        {tab === 'data' && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`${KEY}.fields.outputs`)}</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-surface/60 p-2 text-xs text-foreground">
              {JSON.stringify(step.outputsSummary, null, 2)}
            </pre>
          </div>
        )}

        {tab === 'sources' && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`${KEY}.fields.sourceCounts`)}</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-surface/60 p-2 text-xs text-foreground">
              {JSON.stringify(step.sourceCounts, null, 2)}
            </pre>
          </div>
        )}

        {tab === 'prompt' && (
          <div>
            <p className="text-xs text-muted">
              {t(`${KEY}.fields.promptHash`)}: <code className="text-foreground">{step.promptHash}</code>
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
              {t(`${KEY}.fields.promptPreview`)}
            </p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-surface/60 p-2 text-xs text-foreground">
              {step.promptPreview}
            </pre>
          </div>
        )}

        {tab === 'model' && (
          <div className="grid gap-1">
            <p className="text-sm text-foreground">
              <span className="text-muted">{t(`${KEY}.fields.model`)}: </span>
              <span>{step.model ?? '—'}</span>
            </p>
            <p className="text-sm text-foreground">
              <span className="text-muted">{t(`${KEY}.fields.tokens`)}: </span>
              <span>{step.tokens ?? '—'}</span>
            </p>
          </div>
        )}

        {tab === 'errors' && (
          <pre className="overflow-x-auto rounded-md bg-surface/60 p-2 text-xs text-danger">
            {step.error}
          </pre>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: RunTrace['status']) {
  return t(`${KEY}.status.${status}` as `${typeof KEY}.status.${RunTrace['status']}`);
}

function RunHeader({ trace }: { trace: RunTrace }) {
  const total = trace.steps.reduce((sum, s) => sum + s.durationMs, 0);
  const generated = trace.finishedAt ?? trace.startedAt;
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={trace.status === 'error' ? 'error' : trace.status === 'running' ? 'warning' : 'success'}>
          {statusLabel(trace.status)}
        </Badge>
        <span className="text-muted">{t(`${KEY}.run.stepCount`, { count: trace.steps.length })}</span>
        <span className="text-muted">·</span>
        <span className="text-muted">{t(`${KEY}.run.total`, { value: formatDuration(total) })}</span>
        {generated ? (
          <>
            <span className="text-muted">·</span>
            <span className="text-muted">{t(`${KEY}.run.generated`, { value: new Date(generated).toLocaleString() })}</span>
          </>
        ) : null}
      </div>
      {trace.error ? (
        <p className="mt-2 text-sm text-danger">
          {t(`${KEY}.run.runError`)}: {trace.error}
        </p>
      ) : null}
    </div>
  );
}

interface AgentTracePanelProps {
  runId: string | null;
}

export default function AgentTracePanel({ runId }: AgentTracePanelProps) {
  const [selected, setSelected] = useState(0);
  const query = useRunTrace(runId, Boolean(runId));

  // A different run has a different step set; start from the first step rather than
  // stranding the previous run's index (which desyncs the detail pane from the list).
  useEffect(() => {
    setSelected(0);
  }, [runId]);

  if (!runId) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
        {t(`${KEY}.empty`)}
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
        {t(`${KEY}.loading`)}
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">
        {t(`${KEY}.error`)}
      </div>
    );
  }

  const trace = query.data;
  const safeSelected = Math.min(selected, Math.max(trace.steps.length - 1, 0));
  const step = trace.steps[safeSelected] ?? null;

  return (
    <div className="grid gap-3">
      <RunHeader trace={trace} />
      {trace.steps.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          {t(`${KEY}.noSteps`)}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <ul className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-2">
            <li className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t(`${KEY}.steps`)}</li>
            {trace.steps.map((s, index) => (
              <li key={`${s.name}-${index}`}>
                <button
                  type="button"
                  aria-current={index === safeSelected}
                  onClick={() => setSelected(index)}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    index === safeSelected ? 'bg-primary/10 text-foreground' : 'text-muted hover:text-foreground',
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium">{stepLabel(s.name)}</span>
                    {s.status === 'error' ? (
                      <Badge variant="error">{statusLabel(s.status)}</Badge>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">{formatDuration(s.durationMs)}</span>
                </button>
              </li>
            ))}
          </ul>

          <div>{step ? <StepDetail key={safeSelected} step={step} /> : null}</div>
        </div>
      )}
    </div>
  );
}
