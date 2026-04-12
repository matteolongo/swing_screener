import { useEffect, useState } from 'react';
import { useWeeklyReview, useUpsertWeeklyReviewMutation } from '@/features/weeklyReview/hooks';

function getCurrentWeekId(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const weekNum = Math.ceil(((now.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

interface WeeklyReviewFormProps {
  weekId?: string;
  onSaved?: () => void;
  title?: string;
  fieldMeta?: Partial<Record<keyof FormState, { label: string; placeholder: string }>>;
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

const FIELDS: Array<{ key: keyof FormState; label: string; placeholder: string }> = [
  { key: 'what_worked', label: 'What Worked', placeholder: 'What setups or decisions went well this week?' },
  { key: 'what_didnt', label: "What Didn't Work", placeholder: 'What went wrong or felt off?' },
  { key: 'rules_violated', label: 'Rules Violated', placeholder: 'Did you break any trading rules?' },
  { key: 'next_week_focus', label: 'Next Week Focus', placeholder: 'What will you focus on or improve?' },
];

export default function WeeklyReviewForm({ weekId, onSaved, title, fieldMeta }: WeeklyReviewFormProps) {
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
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title ?? `Week ${resolvedWeekId}`}
        </h3>
        {updatedAt && (
          <span className="text-[11px] text-gray-400">
            Last saved {new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {fieldMeta?.[key]?.label ?? label}
          </label>
          <textarea
            value={form[key]}
            onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
            rows={3}
            placeholder={fieldMeta?.[key]?.placeholder ?? placeholder}
            className="w-full text-sm px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={upsertMutation.isPending}
          className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {upsertMutation.isPending ? 'Saving…' : 'Save Review'}
        </button>
        {upsertMutation.isSuccess && (
          <span className="text-xs text-emerald-600">Saved.</span>
        )}
        {upsertMutation.isError && (
          <span className="text-xs text-rose-600">Failed to save.</span>
        )}
      </div>
    </div>
  );
}

export { getCurrentWeekId };
