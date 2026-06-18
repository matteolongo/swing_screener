import type { CatalystOpportunity } from '@/features/intelligence/catalysts/types';
import { t } from '@/i18n/t';

const STATE_COLOR: Record<string, string> = {
  CATALYST_ACTIVE: 'bg-success/10 text-success border-success/40',
  TRENDING: 'bg-success/10 text-success border-success/40',
  WATCH: 'bg-warning/10 text-warning border-warning/40',
  COOLING_OFF: 'bg-foreground/5 text-muted border-border',
  QUIET: 'bg-foreground/5 text-muted border-border',
};

interface CatalystContextCardProps {
  opportunity: CatalystOpportunity;
}

export default function CatalystContextCard({ opportunity }: CatalystContextCardProps) {
  const { state, thesis, keyRisks, sources } = opportunity;
  const stateColor = STATE_COLOR[state] ?? 'bg-foreground/5 text-muted border-border';

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
