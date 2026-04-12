import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import type { ChecklistItem, ExecutionReadback } from '@/features/practice/types';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber } from '@/utils/formatters';

interface ExecutionReadbackScreenProps {
  readback: ExecutionReadback;
  failedGateWarnings: string[];
  currency?: 'USD' | 'EUR';
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ExecutionReadbackScreen({
  readback,
  failedGateWarnings,
  currency = 'USD',
  onCancel,
  onConfirm,
}: ExecutionReadbackScreenProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(readback.checklist);

  useEffect(() => {
    setChecklist(readback.checklist);
  }, [readback.checklist]);

  const allChecked = useMemo(
    () => checklist.length > 0 && checklist.every((item) => item.checked),
    [checklist],
  );

  return (
    <div className="space-y-6">
      <Card variant="bordered" className="space-y-6 border-slate-300 bg-slate-950 text-white">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{readback.symbol}</p>
          <h2 className="text-3xl font-semibold">{t('executionReadback.title')}</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">{t('executionReadback.because')}</p>
            <p className="mt-2 text-sm leading-6 text-white">{readback.thesisSummary}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">{t('executionReadback.maxLoss')}</p>
            <p className="mt-2 text-sm leading-6 text-white">
              {formatCurrency(readback.maxLoss, currency)} ({formatNumber(readback.maxLossPercent, 2)}%)
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-300">{t('executionReadback.invalidIf')}</p>
            <p className="mt-2 text-sm leading-6 text-white">{readback.invalidationCondition}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-300">Entry</p>
            <p className="mt-1 font-semibold">{formatCurrency(readback.entry, currency)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-300">Stop</p>
            <p className="mt-1 font-semibold">{formatCurrency(readback.stop, currency)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-300">Target</p>
            <p className="mt-1 font-semibold">{formatCurrency(readback.target, currency)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-300">Shares</p>
            <p className="mt-1 font-semibold">{readback.shares}</p>
          </div>
        </div>
      </Card>

      {failedGateWarnings.length > 0 ? (
        <Card variant="bordered" className="border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
          <h3 className="text-sm font-semibold">{t('executionReadback.checklist.failedGatesWarning')}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {failedGateWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card variant="bordered" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{t('executionReadback.checklist.title')}</h3>
          <p className="text-xs text-slate-500">{t('executionReadback.checklist.allPassedNote')}</p>
        </div>
        <div className="space-y-3">
          {checklist.map((item) => (
            <label
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) => {
                  setChecklist((prev) => prev.map((candidate) => (
                    candidate.id === item.id
                      ? { ...candidate, checked: event.target.checked }
                      : candidate
                  )));
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={onConfirm} disabled={!allChecked}>
            {t('executionReadback.actions.placeTrade')}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {t('executionReadback.actions.cancel')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
