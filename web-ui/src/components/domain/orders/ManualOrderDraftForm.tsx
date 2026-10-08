import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/common/Button';
import Field from '@/components/common/Field';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Textarea from '@/components/common/Textarea';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { useCreateOrderMutation } from '@/features/portfolio/hooks';
import { candidateOrderSchema } from './schemas';
import { isSupportedCurrency, SUPPORTED_CURRENCY_CODES } from '@/types/currency';
import { t } from '@/i18n/t';

export default function ManualOrderDraftForm({ ticker, candidate }: { ticker: string; candidate?: SymbolAnalysisCandidate | null }) {
  const mutation = useCreateOrderMutation();
  const [error, setError] = useState<string | null>(null);
  const risk = candidate?.recommendation?.risk;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const plan = candidateOrderSchema.safeParse({
      orderType: values.get('orderType'), quantity: Number(values.get('quantity')),
      limitPrice: Number(values.get('entry')), stopPrice: Number(values.get('stop')),
      targetPrice: Number(values.get('target')), notes: String(values.get('notes') ?? ''),
    });
    const currency = values.get('currency');
    if (!plan.success || !isSupportedCurrency(currency)) {
      setError(!plan.success ? plan.error.issues[0].message : t('manualOrderDraft.currencyError'));
      return;
    }
    setError(null);
    try {
      await mutation.mutateAsync({ ticker, ...plan.data, currency, saveAsDraft: true, orderKind: 'entry' });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('order.candidateModal.createError'));
    }
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{t('manualOrderDraft.warning')}</p>
      {candidate?.recommendation?.reasonsShort?.map((reason) => <p key={reason} className="text-sm text-muted">{reason}</p>)}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('order.candidateModal.orderType')}><Select name="orderType" defaultValue="BUY_LIMIT"><option value="BUY_LIMIT">{t('order.candidateModal.orderTypeOptions.buyLimit')}</option><option value="BUY_STOP">{t('order.candidateModal.orderTypeOptions.buyStop')}</option></Select></Field>
        <Field label={t('manualOrderDraft.currency')}><Select name="currency" required defaultValue={candidate?.currency ?? ''}><option value="" disabled>{t('manualOrderDraft.chooseCurrency')}</option>{SUPPORTED_CURRENCY_CODES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</Select></Field>
        <Field label={t('order.candidateModal.quantity')}><Input name="quantity" type="number" required min="1" step="1" defaultValue={risk?.shares ?? candidate?.shares} /></Field>
        <Field label={t('manualOrderDraft.entry')}><Input name="entry" type="number" required min="0.0001" step="any" defaultValue={candidate?.suggestedOrderPrice ?? risk?.entry ?? candidate?.entry ?? candidate?.close} /></Field>
        <Field label={t('order.candidateModal.stopPrice')}><Input name="stop" type="number" required min="0.0001" step="any" defaultValue={risk?.stop ?? candidate?.stop} /></Field>
        <Field label={t('manualOrderDraft.target')}><Input name="target" type="number" required min="0.0001" step="any" defaultValue={risk?.target ?? candidate?.target} /></Field>
      </div>
      <Field label={t('order.candidateModal.notes')}><Textarea name="notes" /></Field>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {mutation.isSuccess ? <p role="status" className="text-sm text-success">{t('manualOrderDraft.saved')} <Link className="underline" to="/book" state={{ tab: 'orders', orderFilter: 'draft' }}>{t('manualOrderDraft.manage')}</Link></p> : null}
      <Button type="submit" disabled={mutation.isPending || mutation.isSuccess}>{mutation.isPending ? t('manualOrderDraft.saving') : t('manualOrderDraft.save')}</Button>
    </form>
  );
}
