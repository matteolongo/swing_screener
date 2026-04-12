import Button from '@/components/common/Button';
import Card from '@/components/common/Card';
import LearnSection from '@/components/domain/recommendation/sections/LearnSection';
import DecisionSummaryCard from '@/components/domain/workspace/DecisionSummaryCard';
import { buildLearnEducationVM } from '@/features/recommendation/educationViewModel';
import type { PracticeCard } from '@/features/practice/types';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

const verdictBannerCopy: Record<PracticeCard['verdictBanner'], { label: string; className: string }> = {
  TRADE_NOW: {
    label: t('practice.exercise.options.tradeNow'),
    className: 'bg-emerald-600 text-white',
  },
  WAIT: {
    label: t('practice.exercise.options.wait'),
    className: 'bg-amber-300 text-amber-950',
  },
  AVOID: {
    label: t('practice.exercise.options.avoid'),
    className: 'bg-rose-600 text-white',
  },
};

interface PracticeCardRevealProps {
  card: PracticeCard;
  onRequestExecution: () => void;
  onNext: () => void;
  hasNext: boolean;
}

export default function PracticeCardReveal({
  card,
  onRequestExecution,
  onNext,
  hasNext,
}: PracticeCardRevealProps) {
  const verdictCopy = verdictBannerCopy[card.verdictBanner];
  const learnView = buildLearnEducationVM(
    card.candidate.recommendation?.thesis,
    card.candidate.recommendation?.thesis?.educationGenerated?.learn,
  );

  return (
    <div className="space-y-6">
      <Card variant="bordered" className="overflow-hidden p-0">
        <div className={cn('px-5 py-4', verdictCopy.className)}>
          <p className="text-xs uppercase tracking-[0.2em] opacity-80">
            {card.candidate.ticker}
          </p>
          <h2 className="text-2xl font-semibold">{verdictCopy.label}</h2>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-3">
          {card.evidenceCards.map((evidence) => (
            <div
              key={`${evidence.label}-${evidence.summary}`}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {evidence.label}
              </p>
              <p className={cn(
                'mt-2 text-sm leading-6',
                evidence.status === 'positive'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : evidence.status === 'negative'
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-slate-700 dark:text-slate-300',
              )}>
                {evidence.summary}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {card.candidate.decisionSummary ? (
        <DecisionSummaryCard
          summary={card.candidate.decisionSummary}
          currency={card.candidate.currency}
        />
      ) : null}

      <Card variant="bordered" className="space-y-4">
        <h3 className="text-lg font-semibold">{t('practice.card.whatToLearn')}</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('practice.card.whatToLearn')}
            </p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{card.whatToLearn.keyIdea}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('practice.card.commonMistake')}
            </p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{card.whatToLearn.commonMistake}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('practice.card.ruleToRemember')}
            </p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{card.whatToLearn.ruleToRemember}</p>
          </div>
        </div>
      </Card>

      <LearnSection view={learnView} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={onRequestExecution}
          disabled={card.verdictBanner !== 'TRADE_NOW'}
        >
          {t('executionReadback.actions.placeTrade')}
        </Button>
        <Button variant="secondary" onClick={onNext}>
          {hasNext ? t('practice.card.nextCandidate') : t('practice.card.sessionComplete')}
        </Button>
      </div>
    </div>
  );
}
