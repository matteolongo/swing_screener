import { Loader2 } from 'lucide-react';
import { useScreener } from '@/hooks/useScreener';
import { useAIStore } from '@/store/useAIStore';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/i18n';
import UniverseSelector from './UniverseSelector';
import PresetFilter from './PresetFilter';
import SortControls from './SortControls';
import CandidateRow from './CandidateRow';
import AISidePanel from '@/components/ai/AISidePanel';

export default function ScreenerTab() {
  const { t } = useI18n();
  const { candidates, isLoading, error, refetch } = useScreener();
  const setActiveSymbol = useAIStore((s) => s.setActiveSymbol);
  const mode = useAppStore((s) => s.mode);
  const isIntraday = mode === 'intraday';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-surface">
        <UniverseSelector simplified={isIntraday} />
        {!isIntraday && <PresetFilter />}
        <SortControls simplified={isIntraday} />
        <button
          onClick={refetch}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading && <Loader2 size={12} className="animate-spin" />}
          {isIntraday ? t('screener.runIntradayScreen') : t('screener.run')}
        </button>
        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ml-auto ${isIntraday ? 'bg-accent/20 text-accent' : 'bg-success/20 text-success'}`}>
          {isIntraday ? t('screener.badgeIntraday') : t('screener.badgeFinalClose')}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {error && (
          <div className="px-4 py-3 text-xs text-danger bg-danger/10 border-b border-border">
            {error}
          </div>
        )}

          {!isLoading && candidates.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-secondary text-sm">
            {t('screener.empty')}
          </div>
        )}

        {candidates.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] text-text-secondary uppercase border-b border-border bg-bg-surface sticky top-0">
                <th className="py-2 px-3 font-medium">{t('screener.columns.rank')}</th>
                <th className="py-2 px-3 font-medium">{t('screener.columns.symbol')}</th>
                <th className="py-2 px-3 font-medium">{t('screener.columns.setup')}</th>
                {!isIntraday && <th className="py-2 px-3 font-medium">{t('screener.columns.entry')}</th>}
                {!isIntraday && <th className="py-2 px-3 font-medium">{t('screener.columns.stop')}</th>}
                <th className="py-2 px-3 font-medium">{t('screener.columns.rMultiple')}</th>
                {!isIntraday && <th className="py-2 px-3 font-medium">{t('screener.columns.risk')}</th>}
                {!isIntraday && <th className="py-2 px-3 font-medium">{t('screener.columns.shares')}</th>}
                {!isIntraday && <th className="py-2 px-3 font-medium">{t('screener.columns.sector')}</th>}
                <th className="py-2 px-3 font-medium">{t('screener.columns.price')}</th>
                {!isIntraday && <th className="py-2 px-3 font-medium">{t('screener.columns.close')}</th>}
                {!isIntraday && <th className="py-2 px-3 font-medium">{t('screener.columns.catalyst')}</th>}
                {!isIntraday && <th className="py-2 px-3 font-medium">{t('screener.columns.gain')}</th>}
                {!isIntraday && <th className="py-2 px-3 font-medium">{t('screener.columns.held')}</th>}
                <th className="py-2 px-3 font-medium">{t('screener.columns.ai')}</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <CandidateRow
                  key={c.symbol}
                  candidate={c}
                  isHeld={c.held !== undefined && c.held > 0}
                  onAnalyze={() => setActiveSymbol(c.symbol)}
                  simplified={isIntraday}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AISidePanel />
    </div>
  );
}
