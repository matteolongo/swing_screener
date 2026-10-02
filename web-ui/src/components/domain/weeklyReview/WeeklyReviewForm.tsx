import { useEffect, useState } from 'react';
import Field from '@/components/common/Field';
import Textarea from '@/components/common/Textarea';
import { useWeeklyReview, useUpsertWeeklyReviewMutation } from '@/features/weeklyReview/hooks';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

function getCurrentWeekId(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - isoDay);

  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil((((date.getTime() - yearStart) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

interface WeeklyReviewFormProps {
  weekId?: string;
  onSaved?: () => void;
}

interface FormState {
  what_worked: string;
  what_didnt: string;
  rules_violated: string;
  next_week_focus: string;
}

const BLANK: FormState = {
  what_worked: '',
  what_didnt: '',
  rules_violated: '',
  next_week_focus: '',
};

const FIELDS: Array<{ key: keyof FormState; labelKey: MessageKey; placeholderKey: MessageKey }> = [
  {
    key: 'what_worked',
    labelKey: 'weeklyReview.fields.whatWorked.label',
    placeholderKey: 'weeklyReview.fields.whatWorked.placeholder',
  },
  {
    key: 'what_didnt',
    labelKey: 'weeklyReview.fields.whatDidnt.label',
    placeholderKey: 'weeklyReview.fields.whatDidnt.placeholder',
  },
  {
    key: 'rules_violated',
    labelKey: 'weeklyReview.fields.rulesViolated.label',
    placeholderKey: 'weeklyReview.fields.rulesViolated.placeholder',
  },
  {
    key: 'next_week_focus',
    labelKey: 'weeklyReview.fields.nextWeekFocus.label',
    placeholderKey: 'weeklyReview.fields.nextWeekFocus.placeholder',
  },
];

export default function WeeklyReviewForm({ weekId, onSaved }: WeeklyReviewFormProps) {
  const resolvedWeekId = weekId ?? getCurrentWeekId();
  const reviewQuery = useWeeklyReview(resolvedWeekId);
  const upsertMutation = useUpsertWeeklyReviewMutation();

  const [form, setForm] = useState<FormState>(BLANK);

  useEffect(() => {
    if (reviewQuery.data) {
      setForm({
        what_worked: reviewQuery.data.what_worked,
        what_didnt: reviewQuery.data.what_didnt,
        rules_violated: reviewQuery.data.rules_violated,
        next_week_focus: reviewQuery.data.next_week_focus,
      });
    } else {
      setForm(BLANK);
    }
  }, [reviewQuery.data, resolvedWeekId]);

  const handleSave = () => {
    upsertMutation.mutate(
      { weekId: resolvedWeekId, request: form },
      {
        onSuccess: () => {
          onSaved?.();
        },
      }
    );
  };

  const updatedAt = reviewQuery.data?.updated_at;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {t('weeklyReview.weekLabel', { id: resolvedWeekId })}
        </h3>
        {updatedAt && (
          <span className="text-[11px] text-muted">
            {t('weeklyReview.lastSaved', { date: new Date(updatedAt).toLocaleDateString() })}
          </span>
        )}
      </div>

      {FIELDS.map(({ key, labelKey, placeholderKey }) => (
        <Field key={key} label={t(labelKey)}>
          <Textarea
            value={form[key]}
            onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
            rows={3}
            placeholder={t(placeholderKey)}
            className="px-2 py-1.5 resize-none focus:ring-1 focus:ring-primary/50"
          />
        </Field>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={upsertMutation.isPending}
          className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {upsertMutation.isPending ? t('weeklyReview.actions.saving') : t('weeklyReview.actions.save')}
        </button>
        {upsertMutation.isSuccess && (
          <span className="text-xs text-success">{t('weeklyReview.actions.saved')}</span>
        )}
        {upsertMutation.isError && (
          <span className="text-xs text-danger">{t('weeklyReview.actions.saveError')}</span>
        )}
      </div>
    </div>
  );
}

export { getCurrentWeekId };
