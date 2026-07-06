import { useState } from 'react';

import { useRunTrace } from '@/features/intelligence/hooks';
import type { StepTrace } from '@/features/intelligence/traceTypes';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

type DetailTab = 'data' | 'sources' | 'prompt' | 'model' | 'errors';

const DETAIL_TABS: DetailTab[] = ['data', 'sources', 'prompt', 'model', 'errors'];

const KEY = 'workspacePage.panels.analysis.intelligence.agentTrace';

function StepDetail({ step }: { step: StepTrace }) {
  const [tab, setTab] = useState<DetailTab>('data');

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap gap-1 border-b border-border pb-2" role="tablist">
        {DETAIL_TABS.map((id) => (
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
          <div className="grid gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`${KEY}.fields.inputs`)}</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-surface/60 p-2 text-xs text-foreground">
                {JSON.stringify(step.inputsSummary, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`${KEY}.fields.outputs`)}</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-surface/60 p-2 text-xs text-foreground">
                {JSON.stringify(step.outputsSummary, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {tab === 'sources' && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t(`${KEY}.fields.sourceCounts`)}</p>
            {step.sourceCounts ? (
              <pre className="mt-1 overflow-x-auto rounded-md bg-surface/60 p-2 text-xs text-foreground">
                {JSON.stringify(step.sourceCounts, null, 2)}
              </pre>
            ) : (
              <p className="mt-1 text-sm text-muted">{t(`${KEY}.fields.noSources`)}</p>
            )}
          </div>
        )}

        {tab === 'prompt' && (
          <div>
            {step.promptHash ? (
              <>
                <p className="text-xs text-muted">
                  {t(`${KEY}.fields.promptHash`)}: <code className="text-foreground">{step.promptHash}</code>
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {t(`${KEY}.fields.promptPreview`)}
                </p>
                <pre className="mt-1 overflow-x-auto rounded-md bg-surface/60 p-2 text-xs text-foreground">
                  {step.promptPreview}
                </pre>
              </>
            ) : (
              <p className="text-sm text-muted">{t(`${KEY}.fields.noPrompt`)}</p>
            )}
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
          <pre className="overflow-x-auto rounded-md bg-surface/60 p-2 text-xs text-foreground">
            {step.error ?? t(`${KEY}.fields.noError`)}
          </pre>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: StepTrace['status']) {
  return t(`${KEY}.status.${status}` as `${typeof KEY}.status.${StepTrace['status']}`);
}

interface AgentTracePanelProps {
  runId: string | null;
}

export default function AgentTracePanel({ runId }: AgentTracePanelProps) {
  const [selected, setSelected] = useState(0);
  const query = useRunTrace(runId, Boolean(runId));

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
  const step = trace.steps[selected] ?? trace.steps[0] ?? null;

  return (
    <div className="grid gap-3 md:grid-cols-[220px_1fr]">
      <ul className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-2">
        <li className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t(`${KEY}.steps`)}</li>
        {trace.steps.map((s, index) => (
          <li key={`${s.name}-${index}`}>
            <button
              type="button"
              aria-current={index === selected}
              onClick={() => setSelected(index)}
              className={cn(
                'flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                index === selected ? 'bg-primary/10 text-foreground' : 'text-muted hover:text-foreground',
              )}
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted">
                {statusLabel(s.status)} · {t(`${KEY}.duration`, { ms: Math.round(s.durationMs) })}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div>{step ? <StepDetail step={step} /> : null}</div>
    </div>
  );
}
