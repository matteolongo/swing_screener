import { useState } from 'react';
import clsx from 'clsx';
import type { HistoryEntry } from '@/types/api';
import { useI18n } from '@/i18n';

interface Props {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  isLoading?: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function actionColor(action: string): string {
  switch (action) {
    case 'ENTER': return 'bg-[var(--success)]/20 text-[var(--success)]';
    case 'WATCH': return 'bg-[var(--warning)]/20 text-[var(--warning)]';
    case 'AVOID': return 'bg-[var(--danger)]/20 text-[var(--danger)]';
    default: return 'bg-[var(--border)] text-[var(--text-secondary)]';
  }
}

function convictionWeight(conviction: string): string {
  switch (conviction.toLowerCase()) {
    case 'high': return 'font-bold text-[var(--text-primary)]';
    case 'medium': return 'font-medium text-[var(--text-primary)]';
    default: return 'font-normal text-[var(--text-secondary)]';
  }
}

export default function AnalysisHistory({ entries, onSelect, isLoading }: Props) {
  const { t } = useI18n();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sorted = [...entries].sort(
    (a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime(),
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-16 rounded bg-[var(--bg-surface)]" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center text-[var(--text-secondary)] text-sm">
        {t('analysisHistory.empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((entry) => {
        const key = entry.generated_at + entry.action;
        const isExpanded = expandedId === key;
        return (
          <div key={key} className="rounded bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
            <button
              onClick={() => {
                setExpandedId(isExpanded ? null : key);
                onSelect(entry);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-elevated)]/50 transition-colors"
            >
              <span className="shrink-0 text-[11px] font-mono text-[var(--text-secondary)] w-12">
                {formatDate(entry.generated_at)}
              </span>
              <span className={clsx('shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold', actionColor(entry.action))}>
                {entry.action}
              </span>
              <span className={clsx('shrink-0 text-[11px]', convictionWeight(entry.conviction))}>
                {entry.conviction}
              </span>
              <span className="flex-1 text-[13px] text-[var(--text-primary)] truncate">
                {entry.summary_line}
              </span>
              <span className={clsx('text-[var(--text-secondary)] transition-transform', isExpanded && 'rotate-180')}>
                ▼
              </span>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 pt-1 text-xs text-[var(--text-secondary)] space-y-1.5 border-t border-[var(--border)]">
                <p><span className="text-[var(--text-primary)]">{t('analysisHistory.fullThesis')}</span> {entry.summary_line}</p>
                {entry.watch_for && (
                  <p><span className="text-[var(--text-primary)]">{t('analysisHistory.watchFor')}</span> {entry.watch_for}</p>
                )}
                {entry.pre_open_outlook && (
                  <p><span className="text-[var(--text-primary)]">{t('analysisHistory.preOpen')}</span> {entry.pre_open_outlook}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
