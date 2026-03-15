import OrderReviewExperience from '@/components/domain/orders/OrderReviewExperience';
import { useCreateOrderMutation } from '@/features/portfolio/hooks';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { DEFAULT_CONFIG } from '@/types/config';
import { t } from '@/i18n/t';
import { formatConfidencePercent, formatScreenerScore } from '@/utils/formatters';

interface ActionPanelProps {
  ticker: string;
}

export default function ActionPanel({ ticker }: ActionPanelProps) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const activeStrategyQuery = useActiveStrategyQuery();
  const risk = activeStrategyQuery.data?.risk ?? DEFAULT_CONFIG.risk;
  const candidate = useScreenerStore((state) =>
    state.lastResult?.candidates.find((item) => item.ticker.toUpperCase() === normalizedTicker)
  );
  const createOrderMutation = useCreateOrderMutation();

  const defaultNotes = candidate
    ? t('screener.defaultNotes', {
        score: formatScreenerScore(candidate.score ?? 0),
        confidence: formatConfidencePercent(candidate.confidence ?? 0),
        rank: candidate.rank,
      })
    : t('workspacePage.panels.analysis.manualOrderNotes', { ticker: normalizedTicker });

  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('workspacePage.panels.analysis.actionTitle')}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t('workspacePage.panels.analysis.actionDescription')}
        </p>
      </div>

      <OrderReviewExperience
        context={{
          ticker: normalizedTicker,
          signal: candidate?.signal,
          close: candidate?.close,
          entry: candidate?.entry,
          stop: candidate?.stop,
          shares: candidate?.shares,
          recommendation: candidate?.recommendation,
          sector: candidate?.sector,
          rReward: candidate?.rr,
          score: candidate?.score,
          rank: candidate?.rank,
          atr: candidate?.atr,
          currency: candidate?.currency,
          suggestedOrderType: candidate?.suggestedOrderType,
          suggestedOrderPrice: candidate?.suggestedOrderPrice,
          executionNote: candidate?.executionNote,
        }}
        risk={risk}
        defaultNotes={defaultNotes}
        showManualOrderHint={!candidate}
        onSubmitOrder={(request) => createOrderMutation.mutateAsync(request)}
      />
    </div>
  );
}
