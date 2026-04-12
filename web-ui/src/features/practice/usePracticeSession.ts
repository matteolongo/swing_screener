import { useEffect, useMemo, useState } from 'react';
import { useDailyReview } from '@/features/dailyReview/api';
import { buildPracticeCards } from '@/features/practice/practiceViewModel';
import type { PracticeCard, PracticeSession, VerdictBannerType } from '@/features/practice/types';
import {
  parseUniverseFromStorage,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';
import { t } from '@/i18n/t';

function updateCurrentCard(
  cards: PracticeCard[],
  currentIndex: number,
  updater: (card: PracticeCard) => PracticeCard,
) {
  return cards.map((card, index) => (index === currentIndex ? updater(card) : card));
}

export function usePracticeSession() {
  const selectedUniverse = parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY));
  const reviewQuery = useDailyReview(200, selectedUniverse);
  const nextCards = useMemo(
    () => buildPracticeCards(reviewQuery.data?.newCandidates ?? []),
    [reviewQuery.data?.newCandidates],
  );
  const [cards, setCards] = useState<PracticeCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCards(nextCards);
    setCurrentIndex(0);
  }, [nextCards]);

  const session: PracticeSession | null = useMemo(() => {
    if (!reviewQuery.data) {
      return null;
    }
    return {
      date: reviewQuery.data.summary.reviewDate,
      cards,
      currentIndex,
      objective: t('practice.objective.title'),
    };
  }, [cards, currentIndex, reviewQuery.data]);

  const currentCard = session && currentIndex < session.cards.length
    ? session.cards[currentIndex]
    : null;

  const answerExercise = (answer: VerdictBannerType) => {
    setCards((prev) => updateCurrentCard(prev, currentIndex, (card) => ({
      ...card,
      exerciseState: 'answered',
      userAnswer: answer,
    })));
  };

  const revealExplanation = () => {
    setCards((prev) => updateCurrentCard(prev, currentIndex, (card) => ({
      ...card,
      exerciseState: 'revealed',
    })));
  };

  const advance = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, cards.length));
  };

  return {
    reviewQuery,
    session,
    currentCard,
    advance,
    answerExercise,
    revealExplanation,
  };
}
