import clsx from 'clsx';
import { useAppStore } from '@/store/useAppStore';
import type { CandidateRow as CandidateRowType } from '@/types/api';
import { useI18n } from '@/i18n';

interface Props {
  candidates: CandidateRowType[];
  isLoading: boolean;
}

function rrColor(rr: number): string {
  if (rr >= 2.0) return 'text-success';
  if (rr >= 1.5) return 'text-warning';
  return 'text-danger';
}

function setupColor(setup: string): string {
  const s = setup.toLowerCase();
  if (s === 'breakout') return 'bg-success/20 text-success';
  if (s === 'pullback') return 'bg-accent/20 text-accent';
  return 'bg-elevated text-text-secondary';
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="py-2.5 px-3">
          <div className="h-3 w-14 bg-elevated rounded" />
        </td>
      ))}
    </tr>
  );
}

export default function ScreenerResultsList({ candidates, isLoading }: Props) {
  const { t } = useI18n();
  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">{t('dailyReview.screenerResults.title')}</h3>
        <table className="w-full text-left">
          <tbody>
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">{t('dailyReview.screenerResults.title')}</h3>
        <div className="text-sm text-text-secondary py-4 text-center">
          {t('dailyReview.screenerResults.empty')}
        </div>
      </div>
    );
  }

  const top = candidates.slice(0, 10);

  return (
    <div>
      <h3 className="text-sm font-medium text-text-primary mb-2">{t('dailyReview.screenerResults.title')}</h3>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11px] text-text-secondary uppercase border-b border-border">
            <th className="py-1.5 px-2 font-medium">{t('dailyReview.screenerResults.columns.symbol')}</th>
            <th className="py-1.5 px-2 font-medium">{t('dailyReview.screenerResults.columns.price')}</th>
            <th className="py-1.5 px-2 font-medium">{t('dailyReview.screenerResults.columns.setup')}</th>
            <th className="py-1.5 px-2 font-medium">{t('dailyReview.screenerResults.columns.rMultiple')}</th>
            <th className="py-1.5 px-2 font-medium">{t('dailyReview.screenerResults.columns.sector')}</th>
          </tr>
        </thead>
        <tbody>
          {top.map((c) => (
            <tr key={c.symbol} className="border-b border-border hover:bg-elevated transition-colors text-[13px]">
              <td className="py-2 px-2 font-medium text-text-primary">{c.symbol}</td>
              <td className="py-2 px-2 price-font">{c.price.toFixed(2)}</td>
              <td className="py-2 px-2">
                <span className={clsx('inline-block px-1.5 py-0.5 rounded text-[11px] font-medium', setupColor(c.setup))}>
                  {c.setup}
                </span>
              </td>
              <td className={clsx('py-2 px-2 price-font font-medium', rrColor(c.rr))}>
                {c.rr.toFixed(2)}
              </td>
              <td className="py-2 px-2">
                <span className="inline-block px-1.5 py-0.5 rounded bg-elevated text-text-secondary text-[11px]">
                  {c.sector}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {candidates.length > 10 && (
        <div className="mt-2 text-center">
          <button
            onClick={() => useAppStore.getState().setActiveTab('screener')}
            className="text-accent text-xs hover:underline cursor-pointer"
          >
            {t('dailyReview.screenerResults.viewAll', { count: candidates.length })}
          </button>
        </div>
      )}
    </div>
  );
}
