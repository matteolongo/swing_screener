import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, TrendingUp, TrendingDown, AlertCircle, BarChart3 } from 'lucide-react';
import Button from '@/components/common/Button';
import { runQuickBacktest } from '@/features/backtest/api';
import { QuickBacktestResponse } from '@/features/backtest/types';
import { formatR, formatPercent } from '@/utils/formatters';
import { useConfigStore } from '@/stores/configStore';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { t } from '@/i18n/t';

interface QuickBacktestModalProps {
  ticker: string;
  onClose: () => void;
}

export default function QuickBacktestModal({ ticker, onClose }: QuickBacktestModalProps) {
  const { config } = useConfigStore();
  const activeStrategyQuery = useActiveStrategyQuery();
  const kAtr = activeStrategyQuery.data?.risk.kAtr ?? config.risk.kAtr;
  const [monthsBack, setMonthsBack] = useState(12);
  const [result, setResult] = useState<QuickBacktestResponse | null>(null);

  const backtestMutation = useMutation({
    mutationFn: async () => {
      return runQuickBacktest({
        ticker,
        monthsBack,
        kAtr,
        maxHoldingDays: 20,
      });
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const summary = result?.summary;
  const isPositive = summary && summary.expectancyR > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <BarChart3 className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold">{t('quickBacktestModal.title', { ticker })}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label={t('quickBacktestModal.closeAria')}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">{t('quickBacktestModal.lookbackPeriod')}</label>
            <select
              value={monthsBack}
              onChange={(e) => setMonthsBack(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={backtestMutation.isPending}
            >
              <option value={6}>{t('quickBacktestModal.lookbackOptions.sixMonths')}</option>
              <option value={12}>{t('quickBacktestModal.lookbackOptions.twelveMonths')}</option>
              <option value={24}>{t('quickBacktestModal.lookbackOptions.twentyFourMonths')}</option>
            </select>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
            <div>{t('quickBacktestModal.settingsSummary', { kAtr, maxHoldingDays: 20 })}</div>
          </div>

          {!result && (
            <Button onClick={() => backtestMutation.mutate()} disabled={backtestMutation.isPending} className="w-full">
              {backtestMutation.isPending ? t('quickBacktestModal.running') : t('quickBacktestModal.runBacktest')}
            </Button>
          )}

          {backtestMutation.isError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              {t('quickBacktestModal.errorPrefix')}: {backtestMutation.error.message}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {result.warnings.map((w, i) => (
                <div key={i} className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">{t('quickBacktestModal.cards.period')}</div>
                  <div className="font-semibold">{result.start} → {result.end}</div>
                  <div className="text-xs text-gray-500">{t('quickBacktestModal.cards.bars', { count: result.bars })}</div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">{t('quickBacktestModal.cards.trades')}</div>
                  <div className="text-xl font-semibold">{result.trades}</div>
                </div>

                <div className={`p-3 rounded ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="text-xs text-gray-600">{t('quickBacktestModal.cards.expectancy')}</div>
                  <div className={`text-xl font-bold flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? <TrendingUp className="w-5 h-5 mr-1" /> : <TrendingDown className="w-5 h-5 mr-1" />}
                    {formatR(summary?.expectancyR || 0)}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">{t('quickBacktestModal.cards.winRate')}</div>
                  <div className="text-xl font-bold">{formatPercent((summary?.winrate || 0) * 100)}</div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">{t('quickBacktestModal.cards.profitFactor')}</div>
                  <div className="text-lg font-semibold">{(summary?.profitFactorR || 0).toFixed(2)}</div>
                </div>

                <div className="p-3 bg-red-50 rounded">
                  <div className="text-xs text-gray-600">{t('quickBacktestModal.cards.maxDrawdown')}</div>
                  <div className="text-lg font-semibold text-red-600">{formatR(summary?.maxDrawdownR || 0)}</div>
                </div>
              </div>

              {result.tradesDetail && result.tradesDetail.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium hover:text-blue-600">
                    {t('quickBacktestModal.tradesDetailsToggle', { count: result.tradesDetail.length })}
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {result.tradesDetail.map((t, i) => (
                      <div key={i} className="py-1 border-b text-xs flex justify-between">
                        <span>{t.entryDate}</span>
                        <span className={t.r >= 0 ? 'text-green-600' : 'text-red-600'}>{formatR(t.r)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setResult(null)} className="flex-1">
                  {t('quickBacktestModal.actions.runAgain')}
                </Button>
                <Button onClick={onClose} className="flex-1">
                  {t('common.actions.close')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
