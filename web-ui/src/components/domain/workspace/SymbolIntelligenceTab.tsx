import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import CollapsibleSection from '@/components/common/CollapsibleSection';
import AgentTracePanel from '@/components/domain/workspace/AgentTracePanel';
import IntelligenceChatPanel from '@/components/domain/workspace/IntelligenceChatPanel';
import NarrativeAnalysisCard from '@/components/domain/workspace/NarrativeAnalysisCard';
import PositionReviewPanel from '@/components/domain/workspace/PositionReviewPanel';
import StrategicReviewPanel from '@/components/domain/workspace/StrategicReviewPanel';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import type { RunTrace } from '@/features/intelligence/traceTypes';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import type {
  WorkspaceSourceId,
  WorkspaceSourcePhase,
  WorkspaceSourceState,
} from '@/features/workspaceData/types';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

export interface SymbolIntelligenceTabModel {
  ticker: string;
  selectionVersion: number;
  candidate?: SymbolAnalysisCandidate | null;
  position?: PositionWithMetrics | null;
  analysis: SymbolIntelligence | null;
  intelligenceOutdated: boolean;
  sources: WorkspaceSourceState[];
  trace: RunTrace | null;
  isLoadingAnalysis: boolean;
  isCachedAnalysis: boolean;
  isGenerating: boolean;
  isRefreshingEvidence: boolean;
  generationError: Error | null;
  refreshError: Error | null;
  onRefreshEvidence: () => void;
  onGenerate: (force: boolean) => void;
}

type PipelineStatus = 'pending' | 'running' | 'complete' | 'failed';
type PipelineStep = 'enriching' | 'prompting' | 'generating' | 'formatting' | 'saving';

const PIPELINE_STEPS: Array<{ id: PipelineStep; traceNames: string[] }> = [
  { id: 'enriching', traceNames: ['enrich_request', 'enrich_technicals', 'enrich_polygon', 'resolve_context'] },
  { id: 'prompting', traceNames: ['assemble_inputs', 'build_prompt'] },
  { id: 'generating', traceNames: ['search'] },
  { id: 'formatting', traceNames: ['format', 'postprocess', 'weigh_evidence', 'assemble_result'] },
  { id: 'saving', traceNames: ['persist'] },
];

const SOURCE_IDS: WorkspaceSourceId[] = [
  'screener',
  'prices',
  'fundamentals',
  'evidence',
  'positionOrders',
];

function sourceLabel(id: string): string {
  const known = [
    'screener',
    'prices',
    'fundamentals',
    'evidence',
    'positionOrders',
    'earnings',
    'dividend',
    'technicals',
    'polygon_prices',
  ] as const;
  if ((known as readonly string[]).includes(id)) {
    return t(`workspacePage.intelligence.sources.${id as (typeof known)[number]}`);
  }
  return id;
}

function pipelineStatus(
  step: (typeof PIPELINE_STEPS)[number],
  trace: RunTrace | null,
  isGenerating: boolean,
): PipelineStatus {
  const matching = trace?.steps.filter((item) => step.traceNames.includes(item.name)) ?? [];
  if (matching.some((item) => item.status === 'error')) return 'failed';
  if (matching.length > 0) return 'complete';
  if (!trace && isGenerating && step.id === 'enriching') return 'running';
  return 'pending';
}

function displayDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : t('workspacePage.intelligence.inputs.unavailable');
}

function phaseLabel(phase: WorkspaceSourcePhase): string {
  return t(`workspacePage.data.phases.${phase}`);
}

function ManifestTable({ model }: { model: SymbolIntelligenceTabModel }) {
  const diagnostics = model.analysis?.inputsUsed?.enrichmentDiagnostics ?? [];
  const workspaceSources =
    model.sources.length > 0
      ? model.sources
      : SOURCE_IDS.map<WorkspaceSourceState>((id) => ({
          id,
          ticker: model.ticker,
          selectionVersion: model.selectionVersion,
          phase: 'idle',
          provider: null,
          dataAsOf: null,
          fetchedAt: null,
          cacheOrigin: null,
          missingInputs: [],
          error: null,
        }));
  const rows = [
    ...workspaceSources.filter((source) => source.id !== 'intelligence'),
    ...diagnostics
      .filter((diagnostic) => !SOURCE_IDS.includes(diagnostic.source as WorkspaceSourceId))
      .map((diagnostic) => ({
        id: diagnostic.source,
        provider: null,
        dataAsOf: diagnostic.asOf,
        phase: diagnostic.status === 'failed' ? 'failed' : diagnostic.status === 'missing' ? 'partial' : 'fresh',
        itemCount: diagnostic.itemCount,
        error: diagnostic.message,
      })),
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table
        className="w-full text-left text-sm"
        aria-label={t('workspacePage.intelligence.inputs.title')}
      >
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2">{t('workspacePage.intelligence.inputs.source')}</th>
            <th className="px-3 py-2">{t('workspacePage.intelligence.inputs.provider')}</th>
            <th className="px-3 py-2">{t('workspacePage.intelligence.inputs.asOf')}</th>
            <th className="px-3 py-2">{t('workspacePage.intelligence.inputs.cache')}</th>
            <th className="px-3 py-2">{t('workspacePage.intelligence.inputs.items')}</th>
            <th className="px-3 py-2">{t('workspacePage.intelligence.inputs.failure')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const diagnostic = diagnostics.find((item) => item.source === row.id);
            const rowError =
              typeof row.error === 'string' ? row.error : row.error?.message;
            return (
              <tr key={row.id}>
                <th scope="row" className="px-3 py-2 font-medium text-foreground">
                  {sourceLabel(row.id)}
                </th>
                <td className="px-3 py-2 text-muted">{row.provider ?? '—'}</td>
                <td className="px-3 py-2 text-muted">
                  {displayDate(diagnostic?.asOf ?? row.dataAsOf)}
                </td>
                <td className="px-3 py-2 text-muted">
                  {'cacheOrigin' in row && row.cacheOrigin
                    ? row.cacheOrigin
                    : phaseLabel(row.phase as WorkspaceSourcePhase)}
                </td>
                <td className="px-3 py-2 text-muted">{diagnostic?.itemCount ?? ('itemCount' in row ? row.itemCount : null) ?? '—'}</td>
                <td className="px-3 py-2 text-danger">{diagnostic?.message ?? rowError ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pipeline({ model }: { model: SymbolIntelligenceTabModel }) {
  if (!model.trace && !model.isGenerating && !model.generationError) return null;

  const activeTrace = model.isGenerating ? null : model.trace;
  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('workspacePage.intelligence.pipeline')}
      </h3>
      <ol className="mt-3 grid gap-2 sm:grid-cols-5">
        {PIPELINE_STEPS.map((step) => {
          const status = pipelineStatus(step, activeTrace, model.isGenerating);
          return (
            <li
              key={step.id}
              data-status={status}
              className={cn(
                'rounded-md border px-3 py-2 text-xs font-medium',
                status === 'failed' && 'border-danger/40 bg-danger/10 text-danger',
                status === 'complete' && 'border-success/40 bg-success/10 text-success',
                status === 'running' && 'border-primary/40 bg-primary/10 text-primary',
                status === 'pending' && 'border-border text-muted',
              )}
            >
              <span data-status={status}>{t(`workspacePage.intelligence.steps.${step.id}`)}</span>
            </li>
          );
        })}
      </ol>
      {(model.generationError || model.trace?.status === 'error') && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-danger">
            {model.generationError?.message ?? model.trace?.error ?? t('workspacePage.intelligence.failed')}
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={() => model.onGenerate(true)}>
            {t('workspacePage.data.retry')}
          </Button>
        </div>
      )}
    </section>
  );
}

export default function SymbolIntelligenceTab({ model }: { model: SymbolIntelligenceTabModel }) {
  const hasAnalysis = Boolean(model.analysis?.narrative.trim());
  const resultStatus = model.intelligenceOutdated
    ? 'outdated'
    : model.analysis?.degradedReasons?.length
      ? 'partial'
      : model.isCachedAnalysis
        ? 'cached'
      : 'current';

  return (
    <div className="space-y-3">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t('workspacePage.intelligence.inputs.title')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('workspacePage.intelligence.inputs.description')}
          </p>
        </div>
        <ManifestTable model={model} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={model.isRefreshingEvidence || model.isGenerating}
            onClick={model.onRefreshEvidence}
          >
            {model.isRefreshingEvidence
              ? t('workspacePage.intelligence.refreshingEvidence')
              : t('workspacePage.intelligence.refreshEvidence')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={model.isGenerating || model.isRefreshingEvidence}
            onClick={() => model.onGenerate(false)}
          >
            {model.isGenerating
              ? t('workspacePage.intelligence.generating')
              : t('workspacePage.intelligence.generate')}
          </Button>
          {hasAnalysis && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={model.isGenerating || model.isRefreshingEvidence}
              onClick={() => model.onGenerate(true)}
            >
              {t('workspacePage.intelligence.forceRefresh')}
            </Button>
          )}
        </div>
        {model.refreshError && <p className="text-sm text-danger">{model.refreshError.message}</p>}
      </section>

      <Pipeline model={model} />

      {model.isLoadingAnalysis && !model.analysis ? (
        <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          {t('workspacePage.intelligence.loadingCached')}
        </div>
      ) : model.analysis ? (
        <>
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={resultStatus === 'current' ? 'success' : 'warning'}>
                {t(`workspacePage.intelligence.status.${resultStatus}`)}
              </Badge>
              {model.intelligenceOutdated && (
                <span className="text-sm font-medium text-warning">
                  {t('workspacePage.intelligence.outdated')}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-foreground">{model.analysis.summaryLine}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">
              {model.analysis.narrative}
            </p>
          </section>

          <NarrativeAnalysisCard
            intelligence={model.analysis}
            candidate={model.candidate}
            isPosition={Boolean(model.position)}
          />

          <CollapsibleSection title={t('workspacePage.intelligence.followUps')}>
            <div className="grid gap-3">
              <PositionReviewPanel ticker={model.ticker} position={model.position} />
              <StrategicReviewPanel ticker={model.ticker} />
              <IntelligenceChatPanel
                ticker={model.ticker}
                intelligence={model.analysis}
                candidate={model.candidate}
                position={model.position}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={t('workspacePage.intelligence.historyAndTrace')}>
            <AgentTracePanel runId={model.analysis.runId ?? null} />
          </CollapsibleSection>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          {t('workspacePage.intelligence.empty')}
        </div>
      )}
    </div>
  );
}
