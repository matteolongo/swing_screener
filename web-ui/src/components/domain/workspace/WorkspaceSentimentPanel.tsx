import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Button from '@/components/common/Button';
import SentimentPanel from '@/components/domain/social/SentimentPanel';
import { analyzeSocial } from '@/features/social/api';
import { t } from '@/i18n/t';

interface WorkspaceSentimentPanelProps {
  ticker: string;
}

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

export default function WorkspaceSentimentPanel({ ticker }: WorkspaceSentimentPanelProps) {
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

  const { mutate } = analysisMutation;
  const runAnalysis = useCallback(
    (params: SocialAnalysisParams) => {
      mutate(params);
    },
    [mutate],
  );

  useEffect(() => {
    setLookbackInput('');
    runAnalysis({ symbol: ticker, lookbackInput: '' });
  }, [ticker, runAnalysis]);

  const data = analysisMutation.data;
  const defaultLookback = data?.lookbackHours;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
      <div className="flex flex-col md:flex-row md:items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1" htmlFor="workspace-lookback">
            {t('workspacePage.panels.analysis.sentimentLookback')}
          </label>
          <input
            id="workspace-lookback"
            type="number"
            min={1}
            placeholder={
              defaultLookback
                ? t('socialAnalysisModal.lookbackPlaceholder', { value: defaultLookback })
                : t('socialAnalysisModal.lookbackPlaceholderFallback')
            }
            value={lookbackInput}
            onChange={(event) => setLookbackInput(event.target.value)}
            className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800"
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => analysisMutation.mutate({ symbol: ticker, lookbackInput })}
          disabled={analysisMutation.isPending}
        >
          {analysisMutation.isPending ? t('socialAnalysisModal.refreshing') : t('common.actions.refresh')}
        </Button>
      </div>

      <SentimentPanel
        data={analysisMutation.data ?? null}
        loading={analysisMutation.isPending}
        error={analysisMutation.isError ? (analysisMutation.error as Error).message : undefined}
      />
    </div>
  );
}
