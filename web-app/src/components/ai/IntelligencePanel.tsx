import clsx from 'clsx';
import type { AIAnalysis } from '@/types/api';
import { useI18n } from '@/i18n';

interface Props {
  analysis: AIAnalysis | null;
  isLoading: boolean;
}

function rrColor(rr: number): string {
  if (rr >= 2.0) return 'text-[var(--success)]';
  if (rr >= 1.5) return 'text-[var(--warning)]';
  return 'text-[var(--danger)]';
}

function sentimentColor(s: string): string {
  const v = s.toLowerCase();
  if (v === 'positive') return 'bg-[var(--success)]/20 text-[var(--success)]';
  if (v === 'negative') return 'bg-[var(--danger)]/20 text-[var(--danger)]';
  return 'bg-[var(--border)] text-[var(--text-secondary)]';
}

function Badge({ label, variant }: { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const colors: Record<string, string> = {
    success: 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30',
    warning: 'bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30',
    danger: 'bg-[var(--danger)]/20 text-[var(--danger)] border-[var(--danger)]/30',
    neutral: 'bg-[var(--border)] text-[var(--text-secondary)] border-[var(--border)]',
  };
  return (
    <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border', colors[variant])}>
      {label}
    </span>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
      {title}
    </h3>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-4 bg-[var(--bg-surface)] rounded w-3/4" />
      <div className="h-4 bg-[var(--bg-surface)] rounded w-1/2" />
      <div className="h-20 bg-[var(--bg-surface)] rounded" />
      <div className="h-4 bg-[var(--bg-surface)] rounded w-2/3" />
      <div className="h-10 bg-[var(--bg-surface)] rounded" />
      <div className="h-4 bg-[var(--bg-surface)] rounded w-3/5" />
    </div>
  );
}

export default function IntelligencePanel({ analysis, isLoading }: Props) {
  const { t } = useI18n();
  if (isLoading) return <Skeleton />;
  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
        {t('intelligencePanel.noData')}
      </div>
    );
  }

  const evidenceEntries = analysis.evidence_ledger
    ? Object.entries(analysis.evidence_ledger)
    : [];

  const catalystEntries = analysis.classified_catalysts
    ? Object.entries(analysis.classified_catalysts)
    : [];

  const predictionEntries = analysis.predictions
    ? Object.entries(analysis.predictions)
    : [];

  const newsItems = analysis.news as
    | Array<{ headline?: string; sentiment?: string; source?: string; date?: string }>
    | undefined;

  return (
    <div className="flex flex-col gap-5 text-[13px]">
      {analysis.pre_open_outlook && (
        <div className="px-3 py-2 rounded bg-[var(--warning)]/10 border border-[var(--warning)]/30">
          <span className="text-[11px] font-semibold text-[var(--warning)] uppercase tracking-wider">{t('intelligencePanel.preOpenOutlook')}</span>
          <p className="text-[var(--warning)] text-xs mt-1">{analysis.pre_open_outlook}</p>
        </div>
      )}

      <div>
        <SectionHeader title={t('intelligencePanel.thesis')} />
        <p className="text-[var(--text-primary)] leading-relaxed">{analysis.thesis}</p>
      </div>

      <div>
        <SectionHeader title={t('intelligencePanel.tradePlan')} />
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="px-3 py-2 rounded bg-[var(--bg-surface)]">
            <div className="text-[11px] text-[var(--text-secondary)] mb-0.5">{t('intelligencePanel.entry')}</div>
            <div className="text-sm font-mono font-medium text-[var(--text-primary)]">
              ${analysis.entry.toFixed(2)}
            </div>
          </div>
          <div className="px-3 py-2 rounded bg-[var(--bg-surface)]">
            <div className="text-[11px] text-[var(--text-secondary)] mb-0.5">{t('intelligencePanel.stop')}</div>
            <div className="text-sm font-mono font-medium text-[var(--danger)]">
              ${analysis.stop.toFixed(2)}
            </div>
          </div>
          <div className="px-3 py-2 rounded bg-[var(--bg-surface)]">
            <div className="text-[11px] text-[var(--text-secondary)] mb-0.5">{t('intelligencePanel.target')}</div>
            <div className="text-sm font-mono font-medium text-[var(--success)]">
              ${analysis.target.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="flex gap-4 px-1">
          <div>
            <span className="text-[11px] text-[var(--text-secondary)]">{t('intelligencePanel.rMultiple')} </span>
            <span className={clsx('font-mono font-semibold', rrColor(analysis.rr))}>
              {analysis.rr.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-[var(--text-secondary)]">{t('intelligencePanel.risk')} </span>
            <span className="font-mono font-medium text-[var(--text-primary)]">
              ${Math.max(0.01, analysis.entry - analysis.stop).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {evidenceEntries.length > 0 && (
        <div>
          <SectionHeader title={t('intelligencePanel.evidenceLedger')} />
          <div className="flex flex-col gap-1.5">
            {evidenceEntries.map(([source, data]) => {
              const entry = data as { excerpt?: string; verdict?: string };
              return (
                <div key={source} className="px-3 py-2 rounded bg-[var(--bg-surface)] text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--accent)] font-medium">{source}</span>
                    {entry.verdict && (
                      <Badge
                        label={entry.verdict}
                        variant={entry.verdict === 'supportive' ? 'success' : entry.verdict === 'contradicts' ? 'danger' : 'neutral'}
                      />
                    )}
                  </div>
                  {entry.excerpt && (
                    <span className="text-[var(--text-secondary)]">{entry.excerpt}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {catalystEntries.length > 0 && (
        <div>
          <SectionHeader title={t('intelligencePanel.catalysts')} />
          <div className="flex flex-col gap-1.5">
            {catalystEntries.map(([id, data]) => {
              const cat = data as { type?: string; description?: string; citation?: string };
              return (
                <div key={id} className="px-3 py-2 rounded bg-[var(--bg-surface)] text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    {cat.type && <Badge label={cat.type} variant="neutral" />}
                    <span className="text-[var(--text-primary)]">{cat.description}</span>
                  </div>
                  {cat.citation && (
                    <span className="text-[var(--text-secondary)]">— {cat.citation}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {predictionEntries.length > 0 && (
        <div>
          <SectionHeader title={t('intelligencePanel.predictions')} />
          <div className="flex flex-col gap-1.5">
            {predictionEntries.map(([id, data]) => {
              const pred = data as { direction?: string; reason?: string; reference?: string };
              const isUp = pred.direction?.toLowerCase() === 'up';
              return (
                <div key={id} className="px-3 py-2 rounded bg-[var(--bg-surface)] text-xs flex items-start gap-2">
                  <span className={clsx('font-bold text-sm', isUp ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>
                    {isUp ? '↑' : '↓'}
                  </span>
                  <div>
                    <span className="text-[var(--text-primary)]">{pred.reason}</span>
                    {pred.reference && (
                      <span className="text-[var(--text-secondary)] ml-1">({pred.reference})</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {newsItems && newsItems.length > 0 && (
        <div>
          <SectionHeader title={t('intelligencePanel.newsFeed')} />
          <div className="flex flex-col gap-1.5">
            {newsItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded bg-[var(--bg-surface)]">
                <span className={clsx('shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium', sentimentColor(item.sentiment || 'neutral'))}>
                  {item.sentiment || 'neutral'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-primary)] truncate">{item.headline}</p>
                  {item.date && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{item.date}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
