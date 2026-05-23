import { describe, it, expect } from 'vitest';
import { transformIntelligence } from './types';
import type { SymbolIntelligenceAPI } from './types';

describe('transformIntelligence', () => {
  it('converts snake_case API shape to camelCase', () => {
    const api: SymbolIntelligenceAPI = {
      symbol: 'APAM',
      generated_at: '2026-05-23T10:00:00Z',
      action: 'BUY_NOW',
      conviction: 'high',
      summary_line: 'Cyclical recovery.',
      narrative: '## Why\n...',
      sources: ['https://example.com'],
    };
    const result = transformIntelligence(api);
    expect(result.symbol).toBe('APAM');
    expect(result.generatedAt).toBe('2026-05-23T10:00:00Z');
    expect(result.summaryLine).toBe('Cyclical recovery.');
    expect(result.sources).toHaveLength(1);
  });
});
