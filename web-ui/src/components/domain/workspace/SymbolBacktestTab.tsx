import { useState } from 'react';

import Button from '@/components/common/Button';
import Field from '@/components/common/Field';
import { CONTROL_CLASS } from '@/components/common/Input';
import BacktestResults from '@/components/domain/backtest/BacktestResults';
import { useRunEventStudyMutation } from '@/features/backtest/hooks';
import type { EventStudyRequest } from '@/features/backtest/types';
import { t } from '@/i18n/t';

type PatternStopChoice = 'default' | 'on' | 'off';

interface SymbolBacktestTabProps {
  ticker: string;
}

/**
 * Per-symbol event study inside the analysis canvas. Locked to the selected
 * ticker; runs explicitly (no auto-fetch) so the data pull is intentional.
 */
export default function SymbolBacktestTab({ ticker }: SymbolBacktestTabProps) {
  const [patternStop, setPatternStop] = useState<PatternStopChoice>('default');
  const mutation = useRunEventStudyMutation();

  const handleRun = () => {
    const config: NonNullable<EventStudyRequest['config']> = {};
    if (patternStop !== 'default') config.patternStopEnabled = patternStop === 'on';
    mutation.mutate({
      tickers: [ticker],
      config: Object.keys(config).length > 0 ? config : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{t('backtest.tab.intro', { ticker })}</p>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('backtest.form.patternStop')} className="w-40">
          <select
            className={CONTROL_CLASS}
            value={patternStop}
            onChange={(e) => setPatternStop(e.target.value as PatternStopChoice)}
          >
            <option value="default">—</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </Field>
        <Button onClick={handleRun} disabled={mutation.isPending}>
          {mutation.isPending ? t('backtest.form.running') : t('backtest.form.run')}
        </Button>
      </div>

      {mutation.isError ? <p className="text-sm text-danger">{t('backtest.errors.failed')}</p> : null}

      {mutation.data ? <BacktestResults result={mutation.data} /> : null}

      <p className="text-[11px] text-muted/70">{t('backtest.scopeNote')}</p>
    </div>
  );
}
