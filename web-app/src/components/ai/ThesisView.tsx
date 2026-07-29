import clsx from 'clsx';
import type { AIAnalysis } from '@/types/api';
import { useI18n } from '@/i18n';

interface Props {
  analysis: AIAnalysis;
}

function statusBadge(status: string | undefined, t: (key: string) => string): { label: string; className: string } {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return {
        label: t('positionReview.confirmed'),
        className: 'bg-[var(--success)]/20 text-[var(--success)]',
      };
    case 'contradicted':
      return {
        label: t('positionReview.contradicted'),
        className: 'bg-[var(--danger)]/20 text-[var(--danger)]',
      };
    default:
      return {
        label: t('positionReview.unresolved'),
        className: 'bg-[var(--warning)]/20 text-[var(--warning)]',
      };
  }
}

export default function ThesisView({ analysis }: Props) {
  const { t } = useI18n();
  const badge = statusBadge(analysis.thesis_status, t);

  const predictionsList = (() => {
    if (!analysis.predictions) return [];
    if (Array.isArray(analysis.predictions)) return analysis.predictions;
    return [analysis.predictions];
  })();

  return (
    <div className="flex flex-col gap-4 text-[13px]">
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-[var(--text-secondary)]">{t('thesisView.status')}</span>
        <span
          className={clsx(
            'inline-block px-2 py-0.5 rounded text-[11px] font-medium',
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </div>

      {analysis.what_played_out && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">
            {t('thesisView.whatPlayedOut')}
          </h3>
          <p className="text-[var(--text-primary)] leading-relaxed">
            {analysis.what_played_out}
          </p>
        </div>
      )}

      {analysis.thesis_delta && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">
            {t('thesisView.thesisDelta')}
          </h3>
          <p className="text-[var(--warning)] leading-relaxed">
            {analysis.thesis_delta}
          </p>
        </div>
      )}

      {predictionsList.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-2">
            {t('thesisView.predictions')}
          </h3>
          <div className="flex flex-col gap-2">
            {predictionsList.map((p, i) => {
              const pred = p as Record<string, unknown>;
              const direction = String((pred as Record<string, unknown>).direction || '');
              const reason = String((pred as Record<string, unknown>).reason || '');
              const dirArrow = direction.toLowerCase().startsWith('up') ? '↑' : '↓';

              return (
                <div
                  key={i}
                  className="flex items-start gap-2 px-3 py-2 rounded bg-[var(--bg-surface)]"
                >
                  <span
                    className={clsx(
                      'text-sm font-bold shrink-0 mt-0.5',
                      direction.toLowerCase().startsWith('up')
                        ? 'text-[var(--success)]'
                        : 'text-[var(--danger)]',
                    )}
                  >
                    {dirArrow}
                  </span>
                  <div>
                    {reason && (
                      <span className="text-[var(--text-primary)] text-xs">
                        {reason}
                      </span>
                    )}
                    {pred.target != null && (
                      <span className="text-[var(--text-secondary)] text-[11px] ml-1 font-mono">
                        @ ${Number(pred.target).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
