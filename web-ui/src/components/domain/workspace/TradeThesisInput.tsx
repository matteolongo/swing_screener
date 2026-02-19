import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';

interface TradeThesisInputProps {
  ticker: string;
}

export default function TradeThesisInput({ ticker }: TradeThesisInputProps) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const value = useWorkspaceStore((state) => state.tradeThesisByTicker[normalizedTicker] ?? '');
  const setTradeThesis = useWorkspaceStore((state) => state.setTradeThesis);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <label htmlFor="trade-thesis" className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
        {t('workspacePage.panels.analysis.tradeThesisTitle')}
      </label>
      <textarea
        id="trade-thesis"
        value={value}
        onChange={(event) => setTradeThesis(normalizedTicker, event.target.value)}
        rows={4}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        placeholder={t('workspacePage.panels.analysis.tradeThesisPlaceholder', { ticker: normalizedTicker })}
      />
    </div>
  );
}
