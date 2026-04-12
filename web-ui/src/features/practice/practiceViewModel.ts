import { buildLearnEducationVM } from '@/features/recommendation/educationViewModel';
import type { DailyReviewCandidate } from '@/features/dailyReview/types';
import type { DecisionAction } from '@/features/screener/types';
import type { RiskConfig } from '@/types/config';
import type { ChecklistGate } from '@/types/recommendation';
import { t } from '@/i18n/t';
import type {
  EvidenceCard,
  ExecutionReadback,
  PracticeCard,
  VerdictBannerType,
} from './types';

function actionToVerdictBanner(action?: DecisionAction): VerdictBannerType {
  switch (action) {
    case 'BUY_NOW':
      return 'TRADE_NOW';
    case 'BUY_ON_PULLBACK':
    case 'WAIT_FOR_BREAKOUT':
    case 'TACTICAL_ONLY':
    case 'WATCH':
      return 'WAIT';
    case 'AVOID':
    case 'MANAGE_ONLY':
    default:
      return 'AVOID';
  }
}

function toPercent(value?: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value! <= 1 ? value! * 100 : value!;
}

function pushEvidence(
  target: EvidenceCard[],
  label: string,
  status: EvidenceCard['status'],
  values: string[] | undefined,
  limit = 2,
) {
  for (const value of values ?? []) {
    const summary = String(value).trim();
    if (!summary) {
      continue;
    }
    target.push({ label, status, summary });
    if (target.length >= limit) {
      break;
    }
  }
}

function gatesToEvidence(gates: ChecklistGate[] | undefined): EvidenceCard[] {
  return (gates ?? []).slice(0, 3).map((gate) => ({
    label: gate.gateName.toLowerCase().replace(/_/g, ' '),
    status: gate.passed ? 'positive' : 'negative',
    summary: gate.explanation,
  }));
}

function buildEvidenceCards(candidate: DailyReviewCandidate): EvidenceCard[] {
  const cards: EvidenceCard[] = [];
  const drivers = candidate.decisionSummary?.drivers;

  pushEvidence(cards, 'trend', 'positive', drivers?.positives, 2);
  pushEvidence(cards, 'risk', 'negative', drivers?.negatives, 3);
  pushEvidence(cards, 'watchout', 'neutral', drivers?.warnings, 4);

  for (const gateCard of gatesToEvidence(candidate.recommendation?.checklist)) {
    if (cards.length >= 5) {
      break;
    }
    cards.push(gateCard);
  }

  if (cards.length === 0) {
    const summary =
      candidate.decisionSummary?.explanation?.summaryLine ??
      candidate.decisionSummary?.whatToDo ??
      candidate.recommendation?.education.whatToLearn ??
      'Review the setup before acting.';
    cards.push({ label: 'setup', status: 'neutral', summary });
  }

  return cards.slice(0, 5);
}

export function buildPracticeCards(candidates: DailyReviewCandidate[]): PracticeCard[] {
  return candidates.map((candidate) => {
    const decisionSummary = candidate.decisionSummary;
    const learnView = buildLearnEducationVM(
      candidate.recommendation?.thesis,
      candidate.recommendation?.thesis?.educationGenerated?.learn,
    );
    return {
      candidate,
      verdictBanner: actionToVerdictBanner(decisionSummary?.action),
      evidenceCards: buildEvidenceCards(candidate),
      whatToLearn: {
        keyIdea:
          candidate.recommendation?.education.whatToLearn ||
          decisionSummary?.explanation?.summaryLine ||
          learnView.summary,
        commonMistake:
          candidate.recommendation?.education.commonBiasWarning ||
          decisionSummary?.mainRisk ||
          'Avoid acting before you can explain the stop and invalidation.',
        ruleToRemember:
          candidate.recommendation?.thesis?.invalidationRules?.[0]?.condition ||
          decisionSummary?.whatToDo ||
          'Wait for a setup with a defined stop and favorable reward-to-risk.',
      },
      exerciseState: 'prompt',
    };
  });
}

export function buildExecutionReadback(
  candidate: DailyReviewCandidate,
  risk: RiskConfig,
): ExecutionReadback {
  const recommendationRisk = candidate.recommendation?.risk;
  const entry = recommendationRisk?.entry ?? candidate.entry;
  const stop = recommendationRisk?.stop ?? candidate.stop;
  const target = recommendationRisk?.target ?? candidate.entry + (candidate.entry - candidate.stop) * candidate.rReward;
  const shares = recommendationRisk?.shares ?? candidate.shares;
  const maxLoss = recommendationRisk?.riskAmount ?? Math.max(0, (entry - stop) * shares);
  const maxLossPercent = recommendationRisk?.riskPct != null
    ? toPercent(recommendationRisk.riskPct)
    : risk.accountSize > 0
      ? (maxLoss / risk.accountSize) * 100
      : 0;
  const checklist = [
    ...(candidate.recommendation?.checklist ?? []).map((gate, index) => ({
      id: `${candidate.ticker}-gate-${index}`,
      label: `${gate.gateName}: ${gate.explanation}`,
      checked: false,
    })),
    {
      id: `${candidate.ticker}-max-loss`,
      label: t('executionReadback.checklist.understandMaxLoss'),
      checked: false,
    },
  ];

  return {
    symbol: candidate.ticker,
    entry,
    stop,
    target,
    shares,
    maxLoss,
    maxLossPercent,
    invalidationCondition:
      candidate.recommendation?.thesis?.invalidationRules?.[0]?.condition ??
      candidate.decisionSummary?.mainRisk ??
      'The trade thesis is invalid if price loses the planned stop zone.',
    thesisSummary:
      candidate.decisionSummary?.explanation?.summaryLine ??
      candidate.decisionSummary?.whatToDo ??
      candidate.recommendation?.education.whatToLearn ??
      'This setup is being placed because the current trend and risk plan still align.',
    checklist,
    allChecked: false,
  };
}
