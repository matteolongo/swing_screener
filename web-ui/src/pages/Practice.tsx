import { useMemo, useState } from 'react';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';
import ExecutionReadbackScreen from '@/components/domain/practice/ExecutionReadbackScreen';
import PracticeCardExercise from '@/components/domain/practice/PracticeCardExercise';
import PracticeCardReveal from '@/components/domain/practice/PracticeCardReveal';
import PracticeEmptyState from '@/components/domain/practice/PracticeEmptyState';
import PracticeObjectiveBanner from '@/components/domain/practice/PracticeObjectiveBanner';
import { useConfigDefaultsQuery } from '@/features/config/hooks';
import { usePracticeSession } from '@/features/practice/usePracticeSession';
import { buildExecutionReadback } from '@/features/practice/practiceViewModel';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber } from '@/utils/formatters';

function buildDefaultNotes(entry: number, rr: number, liveStop?: number, freshStop?: number) {
  if (liveStop != null && freshStop != null) {
    return t('dailyReview.defaultAddOnNotes', {
      liveStop: formatCurrency(liveStop),
      freshStop: formatCurrency(freshStop),
      rr: formatNumber(rr, 2),
    });
  }

  return t('dailyReview.defaultNotes', {
    entry: formatCurrency(entry),
    rr: formatNumber(rr, 2),
  });
}

export default function Practice() {
  const { session, currentCard, answerExercise, revealExplanation, advance, reviewQuery } = usePracticeSession();
  const activeStrategyQuery = useActiveStrategyQuery();
  const configDefaultsQuery = useConfigDefaultsQuery();
  const risk = activeStrategyQuery.data?.risk ?? configDefaultsQuery.data?.risk;
  const [executionTargetTicker, setExecutionTargetTicker] = useState<string | null>(null);
  const [orderModalTicker, setOrderModalTicker] = useState<string | null>(null);

  const executionCard = useMemo(
    () => session?.cards.find((card) => card.candidate.ticker === executionTargetTicker) ?? null,
    [executionTargetTicker, session?.cards],
  );
  const orderCard = useMemo(
    () => session?.cards.find((card) => card.candidate.ticker === orderModalTicker) ?? null,
    [orderModalTicker, session?.cards],
  );

  if (reviewQuery.isLoading) {
    return <p className="text-sm text-slate-500">{t('common.table.loading')}</p>;
  }

  if (reviewQuery.isError) {
    return <p className="text-sm text-rose-600">{t('common.errors.generic')}</p>;
  }

  if (!session || session.cards.length === 0) {
    return <PracticeEmptyState />;
  }

  if (!risk) {
    return <p className="text-sm text-slate-500">{t('common.table.loading')}</p>;
  }

  if (executionCard) {
    const readback = buildExecutionReadback(executionCard.candidate, risk);
    const failedGates = executionCard.candidate.recommendation?.checklist
      ?.filter((gate) => !gate.passed)
      .map((gate) => `${gate.gateName}: ${gate.explanation}`) ?? [];

    return (
      <ExecutionReadbackScreen
        readback={readback}
        failedGateWarnings={failedGates}
        currency={executionCard.candidate.currency}
        onCancel={() => setExecutionTargetTicker(null)}
        onConfirm={() => {
          setExecutionTargetTicker(null);
          setOrderModalTicker(executionCard.candidate.ticker);
        }}
      />
    );
  }

  const currentIndex = session.currentIndex;
  const completed = currentCard == null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PracticeObjectiveBanner
        date={session.date}
        candidateCount={session.cards.length}
        currentIndex={currentIndex}
      />

      {completed ? (
        <PracticeEmptyState />
      ) : currentCard.exerciseState === 'revealed' ? (
        <PracticeCardReveal
          card={currentCard}
          onRequestExecution={() => setExecutionTargetTicker(currentCard.candidate.ticker)}
          onNext={advance}
          hasNext={currentIndex < session.cards.length - 1}
        />
      ) : (
        <PracticeCardExercise
          exercise={{
            prompt: `${currentCard.candidate.ticker}: ${currentCard.candidate.name ?? currentCard.candidate.signal}`,
            options: ['TRADE_NOW', 'WAIT', 'AVOID'],
            correctAnswer: currentCard.verdictBanner,
            exerciseState: currentCard.exerciseState,
            userAnswer: currentCard.userAnswer,
          }}
          onAnswer={answerExercise}
          onReveal={revealExplanation}
        />
      )}

      {orderCard ? (
        <CandidateOrderModal
          candidate={{
            ticker: orderCard.candidate.ticker,
            signal: orderCard.candidate.signal,
            close: orderCard.candidate.close,
            entry: orderCard.candidate.entry,
            stop: orderCard.candidate.stop,
            shares: orderCard.candidate.shares,
            recommendation: orderCard.candidate.recommendation,
            sector: orderCard.candidate.sector,
            rReward: orderCard.candidate.rReward,
            score: orderCard.candidate.score,
            rank: orderCard.candidate.rank,
            atr: orderCard.candidate.atr,
            currency: orderCard.candidate.currency,
            suggestedOrderType: orderCard.candidate.suggestedOrderType,
            suggestedOrderPrice: orderCard.candidate.suggestedOrderPrice,
            executionNote: orderCard.candidate.executionNote,
            positionId: orderCard.candidate.sameSymbol?.positionId,
            sameSymbol: orderCard.candidate.sameSymbol,
          }}
          risk={risk}
          defaultNotes={buildDefaultNotes(
            orderCard.candidate.entry,
            orderCard.candidate.rReward,
            orderCard.candidate.sameSymbol?.executionStop,
            orderCard.candidate.sameSymbol?.freshSetupStop,
          )}
          onClose={() => setOrderModalTicker(null)}
          onSuccess={() => setOrderModalTicker(null)}
        />
      ) : null}
    </div>
  );
}
