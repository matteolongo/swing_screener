import CachedSymbolCandleChart from '@/components/domain/market/CachedSymbolCandleChart';
import AnalysisDecisionStrip from '@/components/domain/workspace/AnalysisDecisionStrip';
import ManagePositionPanel from '@/components/domain/workspace/ManagePositionPanel';
import TechnicalMetricsGrid from '@/components/domain/workspace/TechnicalMetricsGrid';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import type { CatalystOpportunity } from '@/features/intelligence/catalysts/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { t } from '@/i18n/t';
import { formatDateTime, formatNumber, formatPercent } from '@/utils/formatters';
import type { WorkspaceSourceState } from '@/features/workspaceData/types';
import SourceHealthSummary from './SourceHealthSummary';

interface QuerySummary<T> {
  data: T | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export interface SymbolOverviewModel {
  ticker: string;
  candidate?: SymbolAnalysisCandidate | null;
  position?: PositionWithMetrics | null;
  fundamentals: QuerySummary<FundamentalSnapshot>;
  catalyst: QuerySummary<CatalystOpportunity>;
  intelligenceOutdated: boolean;
  sources?: WorkspaceSourceState[];
  onOpenFundamentals: () => void;
  onOpenIntelligence: () => void;
  onPrepareOrder?: () => void;
  isWatched?: boolean;
  isPendingWatch?: boolean;
  onWatch?: () => void;
  onUnwatch?: () => void;
}

function SummaryLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <a
      href="#"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      className="text-xs font-semibold text-primary hover:underline"
    >
      {label}
    </a>
  );
}

export default function SymbolOverviewTab({ model }: { model: SymbolOverviewModel }) {
  const { candidate, position, fundamentals, catalyst } = model;
  const summary = candidate?.decisionSummary;
  const partialDependencies = [
    fundamentals.isError ? t('workspacePage.overview.dependencies.fundamentals') : null,
    catalyst.isError ? t('workspacePage.overview.dependencies.catalysts') : null,
  ].filter((dependency): dependency is string => dependency != null);
  const supports = summary?.drivers.positives.filter(Boolean).slice(0, 3) ?? [];
  const opposition = summary?.drivers.negatives.filter(Boolean).slice(0, 3) ?? [];

  return (
    <div className="space-y-3">
      <SourceHealthSummary sources={model.sources ?? []} />
      <AnalysisDecisionStrip
        ticker={model.ticker}
        candidate={candidate}
        position={position}
        onPrepareOrder={model.onPrepareOrder}
        isWatched={model.isWatched}
        isPendingWatch={model.isPendingWatch}
        onWatch={model.onWatch}
        onUnwatch={model.onUnwatch}
        decisionContext={summary ? (
          <section className="rounded-lg border border-border bg-surface p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('workspacePage.overview.decisionRationale')}
            </h3>
            <dl className="mt-2 grid gap-3 md:grid-cols-3">
              {[
                [t('workspacePage.overview.whatToDo'), summary.whatToDo],
                [t('workspacePage.overview.whyNow'), summary.whyNow],
                [t('workspacePage.overview.mainRisk'), summary.mainRisk],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold text-muted">{label}</dt>
                  <dd className="mt-1 text-sm text-foreground">{value || t('workspacePage.overview.notAvailable')}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      />

      {summary ? (
        <section className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-3">
              <h3 className="text-sm font-semibold text-foreground">{t('workspacePage.overview.supports')}</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {supports.map((signal) => <li key={signal} aria-label={t('workspacePage.overview.supportingSignal')}>+ {signal}</li>)}
                {supports.length === 0 ? <li>{t('workspacePage.overview.noSignals')}</li> : null}
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <h3 className="text-sm font-semibold text-foreground">{t('workspacePage.overview.opposition')}</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {opposition.map((signal) => <li key={signal} aria-label={t('workspacePage.overview.opposingSignal')}>− {signal}</li>)}
                {opposition.length === 0 ? <li>{t('workspacePage.overview.noSignals')}</li> : null}
              </ul>
            </div>
        </section>
      ) : null}

      {partialDependencies.length > 0 ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="text-sm font-semibold text-warning">{t('workspacePage.data.partial')}</p>
          <p className="mt-1 text-xs text-muted">
            {t('workspacePage.overview.partialDependencies', { dependencies: partialDependencies.join(', ') })}
          </p>
        </div>
      ) : null}

      {model.intelligenceOutdated ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {t('workspacePage.overview.intelligenceOutdated')}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">{t('workspacePage.overview.fundamentals')}</h3>
            <SummaryLink label={t('workspacePage.overview.openFundamentals')} onClick={model.onOpenFundamentals} />
          </div>
          {fundamentals.data ? (
            <>
              <p className="mt-2 text-sm text-muted">
                {t('workspacePage.overview.fundamentalsSummary', {
                  pe: fundamentals.data.trailingPe == null ? '—' : formatNumber(fundamentals.data.trailingPe, 1),
                  growth: fundamentals.data.revenueGrowthYoy == null ? '—' : formatPercent(fundamentals.data.revenueGrowthYoy, 1),
                  margin: fundamentals.data.grossMargin == null ? '—' : formatPercent(fundamentals.data.grossMargin, 1),
                })}
              </p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(fundamentals.data.updatedAt)}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {fundamentals.isLoading ? t('workspacePage.overview.loading') : t('workspacePage.overview.notAvailable')}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">{t('workspacePage.overview.catalysts')}</h3>
            <SummaryLink label={t('workspacePage.overview.openIntelligence')} onClick={model.onOpenIntelligence} />
          </div>
          {catalyst.data ? (
            <>
              <p className="mt-2 text-sm text-muted">{catalyst.data.thesis}</p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(catalyst.data.generatedAt)}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {catalyst.isLoading ? t('workspacePage.overview.loading') : t('workspacePage.overview.notAvailable')}
            </p>
          )}
        </div>
      </section>

      {position ? <ManagePositionPanel position={position} candidate={candidate} /> : null}

      <div data-testid="symbol-candle-chart" className="rounded-lg border border-border bg-surface p-3">
        <CachedSymbolCandleChart ticker={model.ticker} width={820} height={220} />
        {candidate?.patternStop != null ? (
          <p className="mt-2 text-xs text-primary">
            {t('chart.patternStopLabel')}: {candidate.patternStop.toFixed(2)}
            {candidate.currency ? ` ${candidate.currency}` : ''}
            {candidate.patternStopReason ? ` · ${candidate.patternStopReason}` : ''}
          </p>
        ) : null}
      </div>
      {candidate ? <TechnicalMetricsGrid candidate={candidate} /> : null}
    </div>
  );
}
