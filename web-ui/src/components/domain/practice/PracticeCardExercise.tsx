import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import type { DecisionExercise, VerdictBannerType } from '@/features/practice/types';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

const OPTION_KEYS: Record<VerdictBannerType, 'tradeNow' | 'wait' | 'avoid'> = {
  TRADE_NOW: 'tradeNow',
  WAIT: 'wait',
  AVOID: 'avoid',
};

interface PracticeCardExerciseProps {
  exercise: DecisionExercise;
  onAnswer: (answer: VerdictBannerType) => void;
  onReveal: () => void;
}

export default function PracticeCardExercise({
  exercise,
  onAnswer,
  onReveal,
}: PracticeCardExerciseProps) {
  const answered = exercise.exerciseState === 'answered';
  const isCorrect = exercise.userAnswer === exercise.correctAnswer;

  return (
    <Card variant="bordered" className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {t('practice.exercise.prompt')}
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {exercise.prompt}
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {exercise.options.map((option) => {
          const optionKey = OPTION_KEYS[option];
          const isSelected = exercise.userAnswer === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(option)}
              disabled={answered}
              className={cn(
                'rounded-xl border px-4 py-5 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
              )}
            >
              <span className="text-base font-semibold">
                {t(`practice.exercise.options.${optionKey}`)}
              </span>
            </button>
          );
        })}
      </div>

      {answered ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
          <p className={cn('text-sm font-medium', isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300')}>
            {isCorrect ? t('practice.exercise.correct') : t('practice.exercise.incorrect')}
          </p>
          <Button onClick={onReveal}>
            {t('practice.exercise.seeSystemView')}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
