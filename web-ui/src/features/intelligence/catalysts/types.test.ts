import { describe, it, expect } from 'vitest';
import { transformCatalystOpportunity, transformCatalystReport } from './types';
import type { CatalystOpportunityAPI, CatalystReportAPI } from './types';

const _opp: CatalystOpportunityAPI = {
  ticker: 'STLD',
  state: 'CATALYST_ACTIVE',
  catalyst_strength: 8.0,
  thesis: 'Domestic steel prices rise.',
  key_risks: ['reversal'],
  sources: ['https://reuters.com/1'],
  report_id: 'r1',
  generated_at: '2026-05-24T10:00:00Z',
};

const _report: CatalystReportAPI = {
  report_id: 'r1',
  event_summary: 'Steel tariff.',
  themes: [{ name: 'Steel', summary: 'Cost pressure.', time_horizon: 'short_term', confidence: 0.8 }],
  causal_chains: [],
  beneficiaries: [],
  losers: [],
  hidden_opportunities: [],
  non_actionable_notes: [],
  generated_at: '2026-05-24T10:00:00Z',
};

describe('transformCatalystOpportunity', () => {
  it('maps snake_case fields to camelCase', () => {
    const result = transformCatalystOpportunity(_opp);
    expect(result.catalystStrength).toBe(8.0);
    expect(result.keyRisks).toEqual(['reversal']);
    expect(result.reportId).toBe('r1');
    expect(result.generatedAt).toBe('2026-05-24T10:00:00Z');
  });

  it('preserves ticker, state, thesis, sources', () => {
    const result = transformCatalystOpportunity(_opp);
    expect(result.ticker).toBe('STLD');
    expect(result.state).toBe('CATALYST_ACTIVE');
    expect(result.thesis).toBe('Domestic steel prices rise.');
    expect(result.sources).toHaveLength(1);
  });
});

describe('transformCatalystReport', () => {
  it('maps report_id and generated_at', () => {
    const result = transformCatalystReport(_report);
    expect(result.reportId).toBe('r1');
    expect(result.generatedAt).toBe('2026-05-24T10:00:00Z');
    expect(result.eventSummary).toBe('Steel tariff.');
    expect(result.themes).toHaveLength(1);
  });
});
