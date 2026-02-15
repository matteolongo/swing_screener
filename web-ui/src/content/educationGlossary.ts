import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

export type EducationMetricKey =
  | 'RR'
  | 'RS'
  | 'ATR'
  | 'SCORE'
  | 'CONFIDENCE'
  | 'MOM_6M'
  | 'MOM_12M'
  | 'RISK_PCT'
  | 'FEE_TO_RISK'
  | 'OVERLAY'
  | 'R_NOW';

export interface EducationGlossaryEntry {
  key: EducationMetricKey;
  label: string;
  title: string;
  tooltip: string;
  explanation: string;
  formula?: string;
  interpretation: string;
}

interface EducationGlossaryMessageKeys {
  label: MessageKey;
  title: MessageKey;
  tooltip: MessageKey;
  explanation: MessageKey;
  interpretation: MessageKey;
  formula?: MessageKey;
}

const EDUCATION_GLOSSARY_MESSAGE_KEYS: Record<EducationMetricKey, EducationGlossaryMessageKeys> = {
  RR: {
    label: 'educationGlossary.entries.rr.label',
    title: 'educationGlossary.entries.rr.title',
    tooltip: 'educationGlossary.entries.rr.tooltip',
    explanation: 'educationGlossary.entries.rr.explanation',
    formula: 'educationGlossary.entries.rr.formula',
    interpretation: 'educationGlossary.entries.rr.interpretation',
  },
  RS: {
    label: 'educationGlossary.entries.rs.label',
    title: 'educationGlossary.entries.rs.title',
    tooltip: 'educationGlossary.entries.rs.tooltip',
    explanation: 'educationGlossary.entries.rs.explanation',
    formula: 'educationGlossary.entries.rs.formula',
    interpretation: 'educationGlossary.entries.rs.interpretation',
  },
  ATR: {
    label: 'educationGlossary.entries.atr.label',
    title: 'educationGlossary.entries.atr.title',
    tooltip: 'educationGlossary.entries.atr.tooltip',
    explanation: 'educationGlossary.entries.atr.explanation',
    formula: 'educationGlossary.entries.atr.formula',
    interpretation: 'educationGlossary.entries.atr.interpretation',
  },
  SCORE: {
    label: 'educationGlossary.entries.score.label',
    title: 'educationGlossary.entries.score.title',
    tooltip: 'educationGlossary.entries.score.tooltip',
    explanation: 'educationGlossary.entries.score.explanation',
    interpretation: 'educationGlossary.entries.score.interpretation',
  },
  CONFIDENCE: {
    label: 'educationGlossary.entries.confidence.label',
    title: 'educationGlossary.entries.confidence.title',
    tooltip: 'educationGlossary.entries.confidence.tooltip',
    explanation: 'educationGlossary.entries.confidence.explanation',
    interpretation: 'educationGlossary.entries.confidence.interpretation',
  },
  MOM_6M: {
    label: 'educationGlossary.entries.mom6m.label',
    title: 'educationGlossary.entries.mom6m.title',
    tooltip: 'educationGlossary.entries.mom6m.tooltip',
    explanation: 'educationGlossary.entries.mom6m.explanation',
    formula: 'educationGlossary.entries.mom6m.formula',
    interpretation: 'educationGlossary.entries.mom6m.interpretation',
  },
  MOM_12M: {
    label: 'educationGlossary.entries.mom12m.label',
    title: 'educationGlossary.entries.mom12m.title',
    tooltip: 'educationGlossary.entries.mom12m.tooltip',
    explanation: 'educationGlossary.entries.mom12m.explanation',
    formula: 'educationGlossary.entries.mom12m.formula',
    interpretation: 'educationGlossary.entries.mom12m.interpretation',
  },
  RISK_PCT: {
    label: 'educationGlossary.entries.riskPct.label',
    title: 'educationGlossary.entries.riskPct.title',
    tooltip: 'educationGlossary.entries.riskPct.tooltip',
    explanation: 'educationGlossary.entries.riskPct.explanation',
    formula: 'educationGlossary.entries.riskPct.formula',
    interpretation: 'educationGlossary.entries.riskPct.interpretation',
  },
  FEE_TO_RISK: {
    label: 'educationGlossary.entries.feeToRisk.label',
    title: 'educationGlossary.entries.feeToRisk.title',
    tooltip: 'educationGlossary.entries.feeToRisk.tooltip',
    explanation: 'educationGlossary.entries.feeToRisk.explanation',
    formula: 'educationGlossary.entries.feeToRisk.formula',
    interpretation: 'educationGlossary.entries.feeToRisk.interpretation',
  },
  OVERLAY: {
    label: 'educationGlossary.entries.overlay.label',
    title: 'educationGlossary.entries.overlay.title',
    tooltip: 'educationGlossary.entries.overlay.tooltip',
    explanation: 'educationGlossary.entries.overlay.explanation',
    interpretation: 'educationGlossary.entries.overlay.interpretation',
  },
  R_NOW: {
    label: 'educationGlossary.entries.rNow.label',
    title: 'educationGlossary.entries.rNow.title',
    tooltip: 'educationGlossary.entries.rNow.tooltip',
    explanation: 'educationGlossary.entries.rNow.explanation',
    formula: 'educationGlossary.entries.rNow.formula',
    interpretation: 'educationGlossary.entries.rNow.interpretation',
  },
};

export const SCREENER_GLOSSARY_KEYS: EducationMetricKey[] = [
  'CONFIDENCE',
  'SCORE',
  'ATR',
  'RR',
  'MOM_6M',
  'MOM_12M',
  'RS',
  'OVERLAY',
  'RISK_PCT',
  'FEE_TO_RISK',
];

export const DAILY_REVIEW_GLOSSARY_KEYS: EducationMetricKey[] = [
  'CONFIDENCE',
  'RR',
  'R_NOW',
  'RISK_PCT',
  'FEE_TO_RISK',
];

export function getGlossaryEntry(metricKey: EducationMetricKey): EducationGlossaryEntry {
  const keys = EDUCATION_GLOSSARY_MESSAGE_KEYS[metricKey];
  return {
    key: metricKey,
    label: t(keys.label),
    title: t(keys.title),
    tooltip: t(keys.tooltip),
    explanation: t(keys.explanation),
    formula: keys.formula ? t(keys.formula) : undefined,
    interpretation: t(keys.interpretation),
  };
}
