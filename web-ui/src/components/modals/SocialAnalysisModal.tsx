import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Button from '@/components/common/Button';
import { analyzeSocial } from '@/features/social/api';
import SentimentPanel from '@/components/domain/social/SentimentPanel';
import { t } from '@/i18n/t';

type SocialAnalysisParams = {
  symbol: string;
  lookbackInput: string;
};

function parseLookbackHours(rawValue: string): number | undefined {
  const trimmed = rawValue.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export default function SocialAnalysisModal({
  symbol,
  onClose,
}: {
  symbol: string;
  onClose: () => void;
}) {
  const [lookbackInput, setLookbackInput] = useState('');

  const analysisMutation = useMutation({
    mutationFn: async (params: SocialAnalysisParams) => {
      const lookbackHours = parseLookbackHours(params.lookbackInput);
      return analyzeSocial({
        symbol: params.symbol,
        maxEvents: 100,
        lookbackHours,
      });
    },
  });

  useEffect(() => {
    setLookbackInput('');
    analysisMutation.mutate({ symbol, lookbackInput: '' });
  }, [symbol, analysisMutation.mutate]);

  const data = analysisMutation.data;
  const defaultLookback = data?.lookbackHours;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('socialAnalysisModal.title', { symbol })}</h2>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.actions.close')}
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Lookback override control */}
          <div className="flex flex-col md:flex-row md:items-end gap-2">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1" htmlFor="lookbackHoursInput">
                {t('socialAnalysisModal.lookbackOverride')}
              </label>
              <input
                id="lookbackHoursInput"
                type="number"
                min={1}
                placeholder={
                  defaultLookback
                    ? t('socialAnalysisModal.lookbackPlaceholder', { value: defaultLookback })
                    : t('socialAnalysisModal.lookbackPlaceholderFallback')
                }
                value={lookbackInput}
                onChange={(event) => setLookbackInput(event.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
              />
            </div>
            <Button
              variant="primary"
              onClick={() => analysisMutation.mutate({ symbol, lookbackInput })}
              disabled={analysisMutation.isPending}
            >
              {analysisMutation.isPending ? t('socialAnalysisModal.refreshing') : t('common.actions.refresh')}
            </Button>
          </div>

          {/* Sentiment Panel */}
          <SentimentPanel
            data={data ?? null}
            loading={analysisMutation.isPending}
            error={analysisMutation.isError ? (analysisMutation.error as Error).message : undefined}
          />
        </div>
      </div>
    </div>
  );
}
