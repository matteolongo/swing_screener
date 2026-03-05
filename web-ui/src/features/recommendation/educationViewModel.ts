import {
  GeneratedEducationView,
  Recommendation,
  TradeThesis,
} from '@/types/recommendation';

export interface RecommendationEducationVM {
  title: string;
  summary: string;
  bullets: string[];
  watchouts: string[];
  nextSteps: string[];
  glossaryLinks: string[];
  source?: 'llm' | 'deterministic_fallback';
  generatedAt?: string;
  factsUsed: string[];
}

export interface ThesisEducationVM {
  title: string;
  summary: string;
  bullets: string[];
  watchouts: string[];
  nextSteps: string[];
  source?: 'llm' | 'deterministic_fallback';
  generatedAt?: string;
  factsUsed: string[];
}

export interface LearnEducationVM {
  title: string;
  summary: string;
  concepts: string[];
  watchouts: string[];
  nextSteps: string[];
  glossaryLinks: string[];
  source?: 'llm' | 'deterministic_fallback';
  generatedAt?: string;
  factsUsed: string[];
}

function trimList(values: string[] | undefined, maxItems: number): string[] {
  const out: string[] = [];
  for (const value of values ?? []) {
    const text = String(value).trim();
    if (!text || out.includes(text)) {
      continue;
    }
    out.push(text);
    if (out.length >= maxItems) {
      break;
    }
  }
  return out;
}

function fromGenerated(view?: GeneratedEducationView) {
  if (!view) {
    return undefined;
  }
  return {
    title: view.title,
    summary: view.summary,
    bullets: trimList(view.bullets, 5),
    watchouts: trimList(view.watchouts, 5),
    nextSteps: trimList(view.nextSteps, 5),
    glossaryLinks: trimList(view.glossaryLinks, 4),
    source: view.source,
    generatedAt: view.generatedAt,
    factsUsed: trimList(view.factsUsed, 16),
  };
}

export function buildRecommendationEducationVM(
  recommendation?: Recommendation,
  generated?: GeneratedEducationView
): RecommendationEducationVM {
  const generatedVm = fromGenerated(generated);
  if (generatedVm) {
    return generatedVm;
  }

  const validityFixes = trimList(recommendation?.education?.whatWouldMakeValid ?? [], 4);

  return {
    title: 'Beginner Summary',
    summary:
      recommendation?.education?.whatToLearn ||
      'This setup is shown with deterministic checks and risk planning details.',
    bullets: validityFixes.length
      ? validityFixes
      : trimList(recommendation?.reasonsShort ?? [], 3),
    watchouts: trimList([
      recommendation?.education?.commonBiasWarning || 'Avoid emotional entries and keep to the rule-set.',
    ], 3),
    nextSteps: trimList(
      [
        'Confirm entry, stop, and position size before placing the order.',
        'Skip the trade if one or more checklist gates fail.',
      ],
      3
    ),
    glossaryLinks: ['rr', 'stop', 'position_size'],
    source: undefined,
    generatedAt: undefined,
    factsUsed: [],
  };
}

export function buildThesisEducationVM(
  thesis: TradeThesis,
  generated?: GeneratedEducationView
): ThesisEducationVM {
  const generatedVm = fromGenerated(generated ?? thesis.educationGenerated?.thesis);
  if (generatedVm) {
    return generatedVm;
  }

  return {
    title: 'Plain-English Thesis',
    summary:
      thesis.beginnerExplanation?.text ||
      thesis.explanation.keyInsight,
    bullets: trimList(thesis.explanation.whyQualified, 5),
    watchouts: trimList(thesis.explanation.whatCouldGoWrong, 5),
    nextSteps: trimList(
      [
        'Use the invalidation rules as hard decision points.',
        'If the setup conditions change, re-evaluate before acting.',
      ],
      3
    ),
    source: thesis.beginnerExplanation?.source,
    generatedAt: thesis.beginnerExplanation?.generatedAt,
    factsUsed: [],
  };
}

export function buildLearnEducationVM(
  thesis?: TradeThesis,
  generated?: GeneratedEducationView
): LearnEducationVM {
  const generatedVm = fromGenerated(generated ?? thesis?.educationGenerated?.learn);
  if (generatedVm) {
    return {
      ...generatedVm,
      concepts: generatedVm.bullets,
    };
  }

  const concepts: string[] = [];
  if (thesis?.riskReward != null) {
    concepts.push('Risk/Reward compares planned upside versus downside before entry.');
  }
  if (thesis?.invalidationRules?.length) {
    concepts.push('Invalidation rules define when the trade thesis is no longer valid.');
  }
  if (thesis?.safetyLabel) {
    concepts.push('Safety labels communicate setup complexity for your current skill level.');
  }
  if (thesis?.personality?.conviction) {
    concepts.push('System conviction ranks setup quality, not certainty of outcome.');
  }

  return {
    title: 'Key Trading Concepts',
    summary: 'Learn only the concepts relevant to this current setup.',
    concepts: trimList(concepts, 4),
    watchouts: trimList(['Do not place a trade if you cannot explain your stop and invalidation.'], 2),
    nextSteps: trimList(['Review one concept, then verify how it appears in this symbol.'], 2),
    glossaryLinks: ['rr', 'stop', 'trade_thesis', 'invalidation'],
    source: undefined,
    generatedAt: undefined,
    factsUsed: [],
  };
}
