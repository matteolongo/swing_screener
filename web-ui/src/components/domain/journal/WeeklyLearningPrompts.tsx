import WeeklyReviewForm, { getCurrentWeekId } from '@/components/domain/weeklyReview/WeeklyReviewForm';
import Card from '@/components/common/Card';
import { t } from '@/i18n/t';

export default function WeeklyLearningPrompts() {
  return (
    <Card variant="bordered" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t('journal.weeklyPrompts.title')}</h2>
      </div>
      <WeeklyReviewForm
        weekId={getCurrentWeekId()}
        title={t('journal.weeklyPrompts.title')}
        fieldMeta={{
          what_worked: {
            label: t('journal.weeklyPrompts.whatWorked.label'),
            placeholder: t('journal.weeklyPrompts.whatWorked.hint'),
          },
          what_didnt: {
            label: t('journal.weeklyPrompts.whatNeedsWork.label'),
            placeholder: t('journal.weeklyPrompts.whatNeedsWork.hint'),
          },
          rules_violated: {
            label: t('journal.weeklyPrompts.lessonLearned.label'),
            placeholder: t('journal.weeklyPrompts.lessonLearned.hint'),
          },
          next_week_focus: {
            label: t('journal.weeklyPrompts.nextWeekFocus.label'),
            placeholder: t('journal.weeklyPrompts.nextWeekFocus.hint'),
          },
        }}
      />
    </Card>
  );
}
