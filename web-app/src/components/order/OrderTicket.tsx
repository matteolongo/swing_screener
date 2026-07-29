import { useState, useCallback } from 'react';
import clsx from 'clsx';
import type { AIAnalysis, OrderDraft } from '@/types/api';
import { useAIStore } from '@/store/useAIStore';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/i18n';

interface Props {
  analysis: AIAnalysis;
  onSave?: (ticket: OrderDraft) => void;
}

const COMMISSION_PCT = 0.003;
const MAX_FEE_RISK_PCT = 0.20;
const CONCENTRATION_CAP = 0.20;
const CONCENTRATION_DANGER = 0.30;

export default function OrderTicket({ analysis, onSave }: Props) {
  const { t } = useI18n();
  const accountSize = useAppStore((s) => s.accountSize);
  const mode = useAppStore((s) => s.mode);
  const setDraft = useAIStore((s) => s.setDraft);
  const intradayDisabled = mode === 'intraday';

  const [quantity, setQuantity] = useState(0);
  const [entryPrice, setEntryPrice] = useState(analysis.entry);
  const [stopPrice, setStopPrice] = useState(analysis.stop);
  const [targetPrice, setTargetPrice] = useState(analysis.target);
  const [orderType, setOrderType] = useState<'BUY STOP' | 'BUY LIMIT'>('BUY STOP');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const oneR = Math.max(0.01, entryPrice - stopPrice);
  const rr = (targetPrice - entryPrice) / oneR;
  const riskDollars = oneR * quantity;
  const positionValue = entryPrice * quantity;
  const pctOfAccount = accountSize > 0 ? positionValue / accountSize : 0;
  const fee = positionValue * COMMISSION_PCT;
  const feeGatePass = fee <= riskDollars * MAX_FEE_RISK_PCT;

  const concentrationWarning: string | undefined =
    pctOfAccount > CONCENTRATION_DANGER
      ? 'DANGER'
      : pctOfAccount > CONCENTRATION_CAP
        ? 'WARNING'
        : undefined;

  const reset = useCallback(() => {
    setQuantity(0);
    setEntryPrice(analysis.entry);
    setStopPrice(analysis.stop);
    setTargetPrice(analysis.target);
    setOrderType('BUY STOP');
  }, [analysis]);

  const buildDraft = useCallback((): OrderDraft => ({
    ticker: analysis.ticker,
    side: 'BUY',
    order_type: orderType,
    shares: quantity,
    entry_price: entryPrice,
    stop_price: stopPrice,
    target_price: targetPrice,
    risk_1r: oneR,
    rr,
    risk_usd: riskDollars,
    position_value: positionValue,
    pct_of_account: pctOfAccount,
    est_fees: fee,
    fee_gate_pass: feeGatePass,
    concentration_warning: concentrationWarning,
  }), [analysis.ticker, orderType, quantity, entryPrice, stopPrice, targetPrice, oneR, rr, riskDollars, positionValue, pctOfAccount, fee, feeGatePass, concentrationWarning]);

  const handleCopy = useCallback(async () => {
    const feeStatus = feeGatePass ? 'PASS' : 'FAIL';
    const text = `${analysis.ticker} | BUY | ${quantity} shares @ ${entryPrice.toFixed(2)} | Stop: ${stopPrice.toFixed(2)} | Target: ${targetPrice.toFixed(2)} | R:R ${rr.toFixed(2)} | Risk: $${riskDollars.toFixed(0)} | ${feeStatus}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [analysis.ticker, quantity, entryPrice, stopPrice, targetPrice, rr, riskDollars, feeGatePass]);

  const handleSave = useCallback(() => {
    const draft = buildDraft();
    setDraft(analysis.ticker, draft);
    onSave?.(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [buildDraft, analysis.ticker, setDraft, onSave]);

  return (
    <div className="flex flex-col gap-3 text-[13px]">
      {intradayDisabled && (
        <div className="px-3 py-2 rounded bg-warning/10 border border-warning/30 text-warning text-xs text-center">
          {t('orderTicket.disabledMessage')}
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <div>
          <label className="text-[11px] text-[var(--text-secondary)]">{t('orderTicket.ticker')}</label>
          <div className="text-[var(--text-primary)] font-medium">{analysis.ticker}</div>
        </div>
        <div>
          <label className="text-[11px] text-[var(--text-secondary)]">{t('orderTicket.side')}</label>
          <div className="text-[var(--success)] font-medium">{t('orderTicket.sideBuy')}</div>
        </div>

        <div className="col-span-2">
          <label className="text-[11px] text-[var(--text-secondary)]">{t('orderTicket.orderType')}</label>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => setOrderType('BUY STOP')}
              disabled={intradayDisabled}
              className={clsx(
                'flex-1 py-1.5 text-xs rounded border font-medium transition-colors',
                orderType === 'BUY STOP'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                intradayDisabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {t('orderTicket.buyStop')}
            </button>
            <button
              type="button"
              onClick={() => setOrderType('BUY LIMIT')}
              disabled={intradayDisabled}
              className={clsx(
                'flex-1 py-1.5 text-xs rounded border font-medium transition-colors',
                orderType === 'BUY LIMIT'
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                intradayDisabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {t('orderTicket.buyLimit')}
            </button>
          </div>
        </div>

        <div className="col-span-2 grid grid-cols-4 gap-2">
          <div>
            <label className="text-[11px] text-[var(--text-secondary)]">{t('orderTicket.shares')}</label>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, Number(e.target.value)))}
                disabled={intradayDisabled}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-secondary)]">{t('orderTicket.entry')}</label>
              <input
                type="number"
                step={0.01}
                min={0.01}
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                disabled={intradayDisabled}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-secondary)]">{t('orderTicket.stop')}</label>
              <input
                type="number"
                step={0.01}
                min={0.01}
                value={stopPrice}
                onChange={(e) => setStopPrice(Number(e.target.value))}
                disabled={intradayDisabled}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-secondary)]">{t('orderTicket.target')}</label>
              <input
                type="number"
                step={0.01}
                min={0.01}
                value={targetPrice}
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                disabled={intradayDisabled}
                className="w-full mt-1 px-2 py-1.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              />
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)] text-xs">{t('orderTicket.oneR')}</span>
            <span className="font-mono text-[var(--text-primary)]">
              ${oneR.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)] text-xs">{t('orderTicket.rr')}</span>
            <span className={clsx(
              'font-mono font-medium',
              rr >= 2.0 ? 'text-[var(--success)]' : rr >= 1.5 ? 'text-[var(--warning)]' : 'text-[var(--danger)]',
            )}>
              {rr.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)] text-xs">{t('orderTicket.riskDollar')}</span>
            <span className="font-mono text-[var(--text-primary)]">
              ${riskDollars.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)] text-xs">{t('orderTicket.positionValue')}</span>
            <span className="font-mono text-[var(--text-primary)]">
              ${positionValue.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)] text-xs">{t('orderTicket.pctAccount')}</span>
            <span className="font-mono text-[var(--text-primary)]">
              {(pctOfAccount * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)] text-xs">{t('orderTicket.estimatedFee')}</span>
            <span className="font-mono text-[var(--text-primary)]">
              ${fee.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-secondary)] text-xs">{t('orderTicket.feeGate')}</span>
            <span
              className={clsx(
                'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                feeGatePass
                  ? 'bg-[var(--success)]/20 text-[var(--success)]'
                  : 'bg-[var(--danger)]/20 text-[var(--danger)]',
              )}
            >
              {feeGatePass ? t('orderTicket.pass') : t('orderTicket.fail')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[var(--text-secondary)] text-xs">{t('orderTicket.concentration')}</span>
            {concentrationWarning ? (
              <span
                className={clsx(
                  'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
                  concentrationWarning === 'DANGER'
                    ? 'bg-[var(--danger)]/20 text-[var(--danger)]'
                    : 'bg-[var(--warning)]/20 text-[var(--warning)]',
                )}
              >
                {concentrationWarning === 'DANGER' ? t('orderTicket.concentrationDanger') : t('orderTicket.concentrationWarning')}
              </span>
            ) : (
              <span className="text-[var(--text-secondary)] text-[10px]">{t('orderTicket.dash')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCopy}
          disabled={intradayDisabled}
          className="flex-1 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? t('orderTicket.copied') : t('orderTicket.copyToClipboard')}
        </button>
        <button
          onClick={reset}
          disabled={intradayDisabled}
          className="flex-1 py-1.5 text-xs rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--warning)] hover:border-[var(--warning)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('orderTicket.reset')}
        </button>
        <button
          onClick={handleSave}
          disabled={intradayDisabled}
          className="flex-1 py-1.5 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saved ? t('orderTicket.saved') : t('orderTicket.saveDraft')}
        </button>
      </div>
    </div>
  );
}
