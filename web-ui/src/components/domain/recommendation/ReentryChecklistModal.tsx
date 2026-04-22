import { useState } from 'react';
import ModalShell from '@/components/common/ModalShell';
import Button from '@/components/common/Button';
import type { PriorTradeContext, ReentryGateResult } from '@/features/screener/types';
import { t } from '@/i18n/t';

interface ReentryChecklistModalProps {
  ticker: string;
  priorTrades: PriorTradeContext;
  reentryGate: ReentryGateResult;
  onProceed: () => void;
  onSkip: () => void;
}

function formatROutcome(r: number): string {
  const sign = r >= 0 ? '+' : '\u2212';
  const abs = Math.abs(r).toFixed(1);
  return `${sign}${abs}R`;
}

function daysSince(dateStr: string): number {
  const exit = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - exit.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ReentryChecklistModal({
  ticker,
  priorTrades,
  reentryGate,
  onProceed,
  onSkip,
}: ReentryChecklistModalProps) {
  const [intentChecked, setIntentChecked] = useState(false);

  const checkEntries = Object.entries(reentryGate.checks);

  return (
    <ModalShell
      title={t('reentryChecklist.title', { ticker })}
      onClose={onSkip}
      closeAriaLabel={t('modal.closeAria')}
      className="max-w-lg"
    >
      {/* Prior trade summary */}
      <section className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('reentryChecklist.priorTradeSummary')}
        </h3>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">{t('reentryChecklist.lastOutcome')}</dt>
            <dd
              className={
                priorTrades.lastROutcome >= 0
                  ? 'font-semibold text-green-700 dark:text-green-400'
                  : 'font-semibold text-red-700 dark:text-red-400'
              }
            >
              {formatROutcome(priorTrades.lastROutcome)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">{t('reentryChecklist.daysSinceExit')}</dt>
            <dd className="font-semibold">{daysSince(priorTrades.lastExitDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">{t('reentryChecklist.tradeCount')}</dt>
            <dd className="font-semibold">{priorTrades.tradeCount}</dd>
          </div>
        </dl>
      </section>

      {/* Stop-out warning */}
      {!priorTrades.wasProfitable && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
          {t('reentryChecklist.stopOutWarning')}
        </div>
      )}

      {/* Gate checks */}
      <section className="mb-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('reentryChecklist.gateChecks')}
        </h3>
        <ul className="space-y-1">
          {checkEntries.map(([key, check]) => (
            <li key={key} className="flex items-start gap-2 text-sm">
              <span
                className={
                  check.passed
                    ? 'mt-0.5 shrink-0 text-green-600 dark:text-green-400'
                    : 'mt-0.5 shrink-0 text-amber-600 dark:text-amber-400'
                }
                aria-label={check.passed ? t('reentryChecklist.checkPassed') : t('reentryChecklist.checkFailed')}
              >
                {check.passed ? '✓' : '⚠'}
              </span>
              <span className={check.passed ? 'text-gray-700 dark:text-gray-300' : 'text-amber-700 dark:text-amber-300'}>
                {check.reason}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Manual intent checkbox */}
      <label className="mb-6 flex cursor-pointer items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={intentChecked}
          onChange={(e) => setIntentChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-blue-600"
        />
        <span>{t('reentryChecklist.manualIntentLabel')}</span>
      </label>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={!intentChecked}
          onClick={onProceed}
          className="flex-1"
        >
          {t('reentryChecklist.proceedButton')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onSkip}
        >
          {t('reentryChecklist.skipButton')}
        </Button>
      </div>
    </ModalShell>
  );
}
