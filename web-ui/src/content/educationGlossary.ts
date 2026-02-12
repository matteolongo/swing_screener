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

export const EDUCATION_GLOSSARY: Record<EducationMetricKey, EducationGlossaryEntry> = {
  RR: {
    key: 'RR',
    label: 'RR',
    title: 'Reward-to-Risk (RR)',
    tooltip: 'Potential upside compared with planned downside.',
    explanation: 'RR compares the distance to target versus the distance to stop.',
    formula: 'RR = (Target - Entry) / (Entry - Stop)',
    interpretation: 'Higher is better. A value above your minimum RR gives more payoff room.',
  },
  RS: {
    key: 'RS',
    label: 'RS',
    title: 'Relative Strength (RS)',
    tooltip: 'How the stock performs versus the benchmark.',
    explanation: 'RS tracks whether this symbol is outperforming the benchmark index.',
    formula: 'RS = Stock return - Benchmark return',
    interpretation: 'Positive RS means leadership. Negative RS means lagging behavior.',
  },
  ATR: {
    key: 'ATR',
    label: 'ATR',
    title: 'Average True Range (ATR)',
    tooltip: 'Average recent daily movement size.',
    explanation: 'ATR measures volatility in price units (not percent).',
    formula: 'ATR(n) = average True Range over n bars',
    interpretation: 'Higher ATR means wider swings and usually wider stop distance.',
  },
  SCORE: {
    key: 'SCORE',
    label: 'Score',
    title: 'Composite Score',
    tooltip: 'Weighted rank score used to sort candidates.',
    explanation: 'Score combines momentum and relative-strength signals into one ranking number.',
    interpretation: 'Higher score means stronger setup quality by the current ranking weights.',
  },
  CONFIDENCE: {
    key: 'CONFIDENCE',
    label: 'Confidence',
    title: 'Setup Confidence',
    tooltip: 'How many quality gates are strong for this setup.',
    explanation: 'Confidence summarizes how robust and consistent the signal is.',
    interpretation: 'High confidence helps, but recommendation still depends on risk gates.',
  },
  MOM_6M: {
    key: 'MOM_6M',
    label: 'Mom 6M',
    title: '6-Month Momentum',
    tooltip: 'Price return over the last 6 months.',
    explanation: 'Momentum captures medium-term trend persistence.',
    formula: 'Mom 6M = return over lookback_6m',
    interpretation: 'Positive values indicate upward trend persistence.',
  },
  MOM_12M: {
    key: 'MOM_12M',
    label: 'Mom 12M',
    title: '12-Month Momentum',
    tooltip: 'Price return over the last 12 months.',
    explanation: 'Momentum captures longer trend persistence.',
    formula: 'Mom 12M = return over lookback_12m',
    interpretation: 'Positive values show long-term strength.',
  },
  RISK_PCT: {
    key: 'RISK_PCT',
    label: 'Risk %',
    title: 'Risk Percent of Account',
    tooltip: 'Portion of account at risk if stop is hit.',
    explanation: 'Risk % is the loss size if the stop executes, as a share of account size.',
    formula: 'Risk % = Risk Amount / Account Size',
    interpretation: 'Keep this near your per-trade risk budget.',
  },
  FEE_TO_RISK: {
    key: 'FEE_TO_RISK',
    label: 'Fee / Risk',
    title: 'Fees Relative to Risk',
    tooltip: 'How much estimated costs consume planned risk.',
    explanation: 'Fee/Risk measures whether costs are small versus expected downside.',
    formula: 'Fee / Risk = Total Fees / Risk Amount',
    interpretation: 'Lower is better. High values can invalidate otherwise good setups.',
  },
  OVERLAY: {
    key: 'OVERLAY',
    label: 'Overlay',
    title: 'Social Overlay',
    tooltip: 'Optional social-risk adjustment layer.',
    explanation: 'Overlay can reduce risk or veto a trade when social conditions are extreme.',
    interpretation: 'OFF/OK means no major social warning. REVIEW/VETO means investigate first.',
  },
  R_NOW: {
    key: 'R_NOW',
    label: 'R Now',
    title: 'Current R Multiple',
    tooltip: 'Current profit/loss measured in initial risk units.',
    explanation: 'R Now compares current P&L with initial risk (1R).',
    formula: 'R Now = (Current Price - Entry) / (Entry - Initial Stop)',
    interpretation: 'Above +1R indicates progress; below 0R means position is underwater.',
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
  return EDUCATION_GLOSSARY[metricKey];
}
