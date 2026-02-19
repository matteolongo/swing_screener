import ThesisSection from '@/components/domain/recommendation/sections/ThesisSection';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';

interface TradeThesisPanelProps {
  ticker: string;
}

export default function TradeThesisPanel({ ticker }: TradeThesisPanelProps) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const candidate = useScreenerStore((state) =>
    state.lastResult?.candidates.find((item) => item.ticker.toUpperCase() === normalizedTicker)
  );
  const thesis = candidate?.recommendation?.thesis;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('workspacePage.panels.analysis.tradeThesisTitle')}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t('workspacePage.panels.analysis.tradeThesisDescription')}
        </p>
      </div>
      {thesis ? (
        <ThesisSection thesis={thesis} />
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('workspacePage.panels.analysis.noThesis')}
        </p>
      )}
    </div>
  );
}
