import type { DailyReviewCandidate } from '@/features/dailyReview/types';
import type { Position } from '@/features/portfolio/types';

export type VerdictBannerType = 'TRADE_NOW' | 'WAIT' | 'AVOID';

export interface EvidenceCard {
  label: string;
  status: 'positive' | 'neutral' | 'negative';
  summary: string;
}

export interface WhatToLearn {
  keyIdea: string;
  commonMistake: string;
  ruleToRemember: string;
}

export interface PracticeCard {
  candidate: DailyReviewCandidate;
  verdictBanner: VerdictBannerType;
  evidenceCards: EvidenceCard[];
  whatToLearn: WhatToLearn;
  exerciseState: 'prompt' | 'answered' | 'revealed';
  userAnswer?: VerdictBannerType;
}

export interface PracticeSession {
  date: string;
  cards: PracticeCard[];
  currentIndex: number;
  objective: string;
}

export interface DecisionExercise {
  prompt: string;
  options: VerdictBannerType[];
  correctAnswer: VerdictBannerType;
  exerciseState: 'prompt' | 'answered' | 'revealed';
  userAnswer?: VerdictBannerType;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ExecutionReadback {
  symbol: string;
  entry: number;
  stop: number;
  target: number;
  shares: number;
  maxLoss: number;
  maxLossPercent: number;
  invalidationCondition: string;
  thesisSummary: string;
  checklist: ChecklistItem[];
  allChecked: boolean;
}

export interface PositionCaseStudy {
  position: Position;
  currentRNow?: number;
  setupType?: string;
  keyQuestion: string;
  invalidationCheck?: string;
  nextMilestone?: string;
}
