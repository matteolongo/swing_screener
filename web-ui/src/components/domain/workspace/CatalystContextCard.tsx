import type { CatalystOpportunity } from '@/features/intelligence/catalysts/types';
import { t } from '@/i18n/t';

const STATE_COLOR: Record<string, string> = {
  CATALYST_ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  TRENDING: 'bg-teal-100 text-teal-700 border-teal-200',
  WATCH: 'bg-amber-100 text-amber-700 border-amber-200',
  COOLING_OFF: 'bg-slate-100 text-slate-600 border-slate-200',
  QUIET: 'bg-slate-100 text-slate-400 border-slate-200',
};

interface CatalystContextCardProps {
  opportunity: CatalystOpportunity;
}

export default function CatalystContextCard({ opportunity }: CatalystContextCardProps) {
  const { state, thesis, keyRisks, sources } = opportunity;
  const stateColor = STATE_COLOR[state] ?? 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('workspacePage.panels.analysis.intelligence.marketCatalyst')}
        </p>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${stateColor}`}>
          {state}
        </span>
      </div>

      <p className="text-sm text-foreground">{thesis}</p>

      {keyRisks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted mb-1">
            {t('workspacePage.panels.analysis.intelligence.keyRisks')}
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {keyRisks.map((risk, i) => (
              <li key={i} className="text-sm text-muted">{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-foreground select-none">
            {t('workspacePage.panels.analysis.intelligence.sources')} ({sources.length})
          </summary>
          <ul className="mt-2 space-y-1 list-none pl-0">
            {sources.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline break-all text-xs">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
