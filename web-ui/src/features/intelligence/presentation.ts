import { t } from '@/i18n/t';
import { IntelligenceOpportunity } from '@/features/intelligence/types';

type OpportunityBand = 'high' | 'medium' | 'low';

interface ParsedExplanations {
  technical?: number;
  catalyst?: number;
  blend?: number;
  evidence: string[];
}

export interface OpportunityEducationView {
  stateLabel: string;
  stateSummary: string;
  opportunityLabel: string;
  technicalLine: string;
  catalystLine: string;
  blendLine: string;
  nextStep: string;
  riskNote: string;
  evidence: string[];
}

const TOKEN_REGEX = /^(technical|catalyst|blend)\s*=\s*(-?\d*\.?\d+)$/i;
const BAND_KEYS = {
  high: 'intelligenceEducation.bands.high',
  medium: 'intelligenceEducation.bands.medium',
  low: 'intelligenceEducation.bands.low',
} as const;
const STATE_LABEL_KEYS = {
  watch: 'intelligenceEducation.state.labels.watch',
  catalyst_active: 'intelligenceEducation.state.labels.catalyst_active',
  trending: 'intelligenceEducation.state.labels.trending',
  cooling_off: 'intelligenceEducation.state.labels.cooling_off',
  quiet: 'intelligenceEducation.state.labels.quiet',
} as const;
const STATE_SUMMARY_KEYS = {
  watch: 'intelligenceEducation.state.summary.watch',
  catalyst_active: 'intelligenceEducation.state.summary.catalyst_active',
  trending: 'intelligenceEducation.state.summary.trending',
  cooling_off: 'intelligenceEducation.state.summary.cooling_off',
  quiet: 'intelligenceEducation.state.summary.quiet',
} as const;
const NEXT_STEP_KEYS = {
  watch: 'intelligenceEducation.next.watch',
  catalyst_active: 'intelligenceEducation.next.catalyst_active',
  trending: 'intelligenceEducation.next.trending',
  cooling_off: 'intelligenceEducation.next.cooling_off',
  quiet: 'intelligenceEducation.next.quiet',
} as const;
const RISK_KEYS = {
  high: 'intelligenceEducation.risk.high',
  medium: 'intelligenceEducation.risk.medium',
  low: 'intelligenceEducation.risk.low',
} as const;
type EducationStateKey = keyof typeof STATE_LABEL_KEYS;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function toPercent(value: number): string {
  return `${(clamp01(value) * 100).toFixed(1)}%`;
}

function toBand(value: number): OpportunityBand {
  const normalized = clamp01(value);
  if (normalized >= 0.75) return 'high';
  if (normalized >= 0.55) return 'medium';
  return 'low';
}

function parseExplanations(explanations: string[]): ParsedExplanations {
  const parsed: ParsedExplanations = {
    evidence: [],
  };

  for (const explanation of explanations) {
    const text = explanation.trim();
    const match = text.match(TOKEN_REGEX);
    if (!match) {
      if (text.length > 0) {
        parsed.evidence.push(text);
      }
      continue;
    }

    const key = match[1].toLowerCase();
    const value = clamp01(Number.parseFloat(match[2]));
    if (key === 'technical') parsed.technical = value;
    if (key === 'catalyst') parsed.catalyst = value;
    if (key === 'blend') parsed.blend = value;
  }

  return parsed;
}

function stateKey(state: string): EducationStateKey {
  const normalized = state.trim().toUpperCase();
  if (normalized === 'WATCH') return 'watch';
  if (normalized === 'CATALYST_ACTIVE') return 'catalyst_active';
  if (normalized === 'TRENDING') return 'trending';
  if (normalized === 'COOLING_OFF') return 'cooling_off';
  return 'quiet';
}

export function buildOpportunityEducation(opportunity: IntelligenceOpportunity): OpportunityEducationView {
  const parsed = parseExplanations(opportunity.explanations ?? []);

  const technical = parsed.technical ?? clamp01(opportunity.technicalReadiness);
  const catalyst = parsed.catalyst ?? clamp01(opportunity.catalystStrength);
  const blend = parsed.blend ?? clamp01(opportunity.opportunityScore);

  const technicalBand = t(BAND_KEYS[toBand(technical)]);
  const catalystBand = t(BAND_KEYS[toBand(catalyst)]);
  const blendBand = t(BAND_KEYS[toBand(blend)]);
  const riskBand = toBand(blend);
  const normalizedState = stateKey(opportunity.state);

  return {
    stateLabel: t(STATE_LABEL_KEYS[normalizedState]),
    stateSummary: t(STATE_SUMMARY_KEYS[normalizedState]),
    opportunityLabel: t('intelligenceEducation.labels.opportunityScore', { value: toPercent(blend) }),
    technicalLine: t('intelligenceEducation.why.technical', {
      value: toPercent(technical),
      band: technicalBand,
    }),
    catalystLine: t('intelligenceEducation.why.catalyst', {
      value: toPercent(catalyst),
      band: catalystBand,
    }),
    blendLine: t('intelligenceEducation.why.blend', {
      value: toPercent(blend),
      band: blendBand,
    }),
    nextStep: t(NEXT_STEP_KEYS[normalizedState]),
    riskNote: t(RISK_KEYS[riskBand]),
    evidence:
      parsed.evidence.length > 0
        ? parsed.evidence
        : [t('intelligenceEducation.evidence.fallback')],
  };
}
