import clsx from 'clsx';
import type { AIAnalysis } from '@/types/api';
import { useI18n } from '@/i18n';

interface Props {
  analysis: AIAnalysis;
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

export default function AnalysisView({ analysis }: Props) {
  const { t } = useI18n();
  const oneR = Math.max(0.01, analysis.entry - analysis.stop);
  const riskDollars = oneR;

  const evidenceEntries = analysis.evidence_ledger
    ? Object.entries(analysis.evidence_ledger)
    : [];

  const citations = analysis.source_citations as
    | Array<{ source?: string; excerpt?: string; url?: string }>
    | undefined;

  const newsItems = analysis.news as
    | Array<{ headline?: string; sentiment?: string; source?: string }>
    | undefined;

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      {analysis.pre_open_outlook && (
        <div className="px-3 py-2 rounded bg-[var(--warning)]/10 border border-[var(--warning)]/30 text-[var(--warning)] text-xs">
          {analysis.pre_open_outlook}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="px-3 py-2 rounded bg-[var(--bg-surface)]">
          <div className="text-[11px] text-[var(--text-secondary)] mb-0.5">{t('analysisView.entry')}</div>
          <div className="text-sm font-mono font-medium text-[var(--text-primary)]">
            ${analysis.entry.toFixed(2)}
          </div>
        </div>
        <div className="px-3 py-2 rounded bg-[var(--bg-surface)]">
          <div className="text-[11px] text-[var(--text-secondary)] mb-0.5">{t('analysisView.stop')}</div>
          <div className="text-sm font-mono font-medium text-[var(--danger)]">
            ${analysis.stop.toFixed(2)}
          </div>
        </div>
        <div className="px-3 py-2 rounded bg-[var(--bg-surface)]">
          <div className="text-[11px] text-[var(--text-secondary)] mb-0.5">{t('analysisView.target')}</div>
          <div className="text-sm font-mono font-medium text-[var(--success)]">
            ${analysis.target.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <div>
          <span className="text-[11px] text-[var(--text-secondary)]">{t('analysisView.rr')} </span>
          <span className={clsx('font-mono font-semibold', rrColor(analysis.rr))}>
            {analysis.rr.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-[var(--text-secondary)]">{t('analysisView.risk')} </span>
          <span className="font-mono font-medium text-[var(--text-primary)]">
            ${riskDollars.toFixed(2)}
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">
          {t('analysisView.thesis')}
        </h3>
        <p className="text-[var(--text-primary)] leading-relaxed">{analysis.thesis}</p>
      </div>

      {evidenceEntries.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-2">
            {t('analysisView.evidence')}
          </h3>
          <div className="flex flex-col gap-2">
            {evidenceEntries.map(([source, excerpt]) => (
              <div
                key={source}
                className="px-3 py-2 rounded bg-[var(--bg-surface)] text-xs"
              >
                <span className="text-[var(--accent)] font-medium">{source}</span>
                <span className="text-[var(--text-secondary)] ml-1">
                  — {typeof excerpt === 'string' ? excerpt : JSON.stringify(excerpt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {citations && citations.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-2">
            {t('analysisView.citations')}
          </h3>
          <div className="flex flex-col gap-1.5">
            {citations.map((c, i) => (
              <div
                key={i}
                className="text-xs text-[var(--text-secondary)] leading-relaxed"
              >
                <span className="text-[var(--accent)]">{c.source}</span>
                {c.excerpt && <span className="ml-1">— {c.excerpt}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {newsItems && newsItems.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-2">
            {t('analysisView.recentNews')}
          </h3>
          <div className="flex flex-col gap-1.5">
            {newsItems.slice(-3).map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-3 py-2 rounded bg-[var(--bg-surface)]"
              >
                <span
                  className={clsx(
                    'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 mt-0.5',
                    sentimentColor(item.sentiment || 'neutral'),
                  )}
                >
                  {item.sentiment || 'neutral'}
                </span>
                <span className="text-xs text-[var(--text-primary)]">
                  {item.headline}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
