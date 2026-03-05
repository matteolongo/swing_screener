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
  const recommendation = candidate?.recommendation;
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
      ) : recommendation ? (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div>
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {t('workspacePage.panels.analysis.whyMatchedFallbackTitle')}
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {t('workspacePage.panels.analysis.whyMatchedFallbackDescription')}
            </p>
          </div>

          {recommendation.reasonsShort.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-amber-900 dark:text-amber-200">
              {recommendation.reasonsShort.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}

          {recommendation.reasonsDetailed.length > 0 ? (
            <div className="space-y-2 rounded-md border border-amber-200 bg-white/70 p-2 dark:border-amber-800 dark:bg-gray-900/50">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                {t('workspacePage.panels.analysis.whyMatchedChecks')}
              </p>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-200">
                {recommendation.reasonsDetailed.map((reason) => (
                  <li key={`${reason.code}-${reason.message}`}>
                    <span className="font-semibold">{reason.code}:</span> {reason.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('workspacePage.panels.analysis.noThesis')}
        </p>
      )}
    </div>
  );
}
