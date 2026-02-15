import { describe, it, expect } from 'vitest';
import { toCandidateViewModel, isRecommended, hasFixes, hasOverlayData } from './viewModel';
import { ScreenerCandidate } from './types';

describe('screener viewModel', () => {
  const baseCandidate: ScreenerCandidate = {
    ticker: 'AAPL',
    currency: 'USD',
    name: 'Apple Inc.',
    sector: 'Technology',
    lastBar: '2026-02-14',
    close: 180.5,
    sma20: 175.0,
    sma50: 170.0,
    sma200: 160.0,
    atr: 3.2,
    momentum6m: 0.15,
    momentum12m: 0.25,
    relStrength: 0.05,
    score: 85.5,
    confidence: 0.75,
    rank: 1,
  };

  describe('toCandidateViewModel', () => {
    it('converts basic candidate with defaults', () => {
      const vm = toCandidateViewModel(baseCandidate);
      
      expect(vm.ticker).toBe('AAPL');
      expect(vm.currency).toBe('USD');
      expect(vm.name).toBe('Apple Inc.');
      expect(vm.sector).toBe('Technology');
      expect(vm.verdict).toBe('UNKNOWN');
      expect(vm.entry).toBeNull();
      expect(vm.stop).toBeNull();
      expect(vm.rr).toBeNull();
      expect(vm.riskUsd).toBeNull();
    });

    it('uses candidate direct fields when no recommendation', () => {
      const candidate: ScreenerCandidate = {
        ...baseCandidate,
        entry: 180.0,
        stop: 175.0,
        rr: 2.5,
        riskUsd: 500,
      };
      
      const vm = toCandidateViewModel(candidate);
      
      expect(vm.entry).toBe(180.0);
      expect(vm.stop).toBe(175.0);
      expect(vm.rr).toBe(2.5);
      expect(vm.riskUsd).toBe(500);
    });

    it('prefers recommendation.risk fields over candidate fields', () => {
      const candidate: ScreenerCandidate = {
        ...baseCandidate,
        entry: 180.0,
        stop: 175.0,
        rr: 2.5,
        riskUsd: 500,
        recommendation: {
          verdict: 'RECOMMENDED',
          summary: 'Strong setup',
          risk: {
            stop: 176.0,
            rr: 3.0,
            riskAmount: 450,
            riskPercent: 0.01,
            isValid: true,
          },
        },
      };
      
      const vm = toCandidateViewModel(candidate);
      
      expect(vm.verdict).toBe('RECOMMENDED');
      expect(vm.entry).toBe(180.0); // from candidate
      expect(vm.stop).toBe(176.0); // from recommendation
      expect(vm.rr).toBe(3.0); // from recommendation
      expect(vm.riskUsd).toBe(450); // from recommendation
    });

    it('extracts fixes from recommendation education', () => {
      const candidate: ScreenerCandidate = {
        ...baseCandidate,
        recommendation: {
          verdict: 'NOT_RECOMMENDED',
          summary: 'Issues present',
          education: {
            whatWouldMakeValid: ['Increase R/R to 2.0', 'Reduce fee/risk ratio'],
          },
        },
      };
      
      const vm = toCandidateViewModel(candidate);
      
      expect(vm.verdict).toBe('NOT_RECOMMENDED');
      expect(vm.fixes).toEqual(['Increase R/R to 2.0', 'Reduce fee/risk ratio']);
    });

    it('extracts overlay data', () => {
      const candidate: ScreenerCandidate = {
        ...baseCandidate,
        overlayStatus: 'REVIEW',
        overlayReasons: ['High attention', 'Sentiment extreme'],
        overlayAttentionZ: 2.5,
        overlaySentimentScore: 0.85,
        overlayRiskMultiplier: 0.5,
      };
      
      const vm = toCandidateViewModel(candidate);
      
      expect(vm.overlayStatus).toBe('REVIEW');
      expect(vm.overlayReasons).toEqual(['High attention', 'Sentiment extreme']);
      expect(vm.overlayAttentionZ).toBe(2.5);
      expect(vm.overlaySentimentScore).toBe(0.85);
      expect(vm.overlayRiskMultiplier).toBe(0.5);
    });

    it('defaults missing name and sector', () => {
      const candidate: ScreenerCandidate = {
        ...baseCandidate,
        name: undefined,
        sector: undefined,
      };
      
      const vm = toCandidateViewModel(candidate);
      
      expect(vm.name).toBe('Unknown');
      expect(vm.sector).toBe('Unknown');
    });

    it('defaults missing lastBar', () => {
      const candidate: ScreenerCandidate = {
        ...baseCandidate,
        lastBar: undefined,
      };
      
      const vm = toCandidateViewModel(candidate);
      
      expect(vm.lastBar).toBe('-');
    });

    it('includes original candidate reference', () => {
      const vm = toCandidateViewModel(baseCandidate);
      
      expect(vm.original).toBe(baseCandidate);
    });
  });

  describe('isRecommended', () => {
    it('returns true for RECOMMENDED verdict', () => {
      const vm = toCandidateViewModel({
        ...baseCandidate,
        recommendation: { verdict: 'RECOMMENDED', summary: 'Good' },
      });
      
      expect(isRecommended(vm)).toBe(true);
    });

    it('returns false for NOT_RECOMMENDED verdict', () => {
      const vm = toCandidateViewModel({
        ...baseCandidate,
        recommendation: { verdict: 'NOT_RECOMMENDED', summary: 'Bad' },
      });
      
      expect(isRecommended(vm)).toBe(false);
    });

    it('returns false for UNKNOWN verdict', () => {
      const vm = toCandidateViewModel(baseCandidate);
      
      expect(isRecommended(vm)).toBe(false);
    });
  });

  describe('hasFixes', () => {
    it('returns true when fixes exist', () => {
      const vm = toCandidateViewModel({
        ...baseCandidate,
        recommendation: {
          verdict: 'NOT_RECOMMENDED',
          summary: 'Issues',
          education: { whatWouldMakeValid: ['Fix 1'] },
        },
      });
      
      expect(hasFixes(vm)).toBe(true);
    });

    it('returns false when no fixes', () => {
      const vm = toCandidateViewModel(baseCandidate);
      
      expect(hasFixes(vm)).toBe(false);
    });
  });

  describe('hasOverlayData', () => {
    it('returns true when overlay status is not OFF and has reasons', () => {
      const vm = toCandidateViewModel({
        ...baseCandidate,
        overlayStatus: 'REVIEW',
        overlayReasons: ['Reason 1'],
      });
      
      expect(hasOverlayData(vm)).toBe(true);
    });

    it('returns false when overlay status is OFF', () => {
      const vm = toCandidateViewModel({
        ...baseCandidate,
        overlayStatus: 'OFF',
        overlayReasons: ['Reason 1'],
      });
      
      expect(hasOverlayData(vm)).toBe(false);
    });

    it('returns false when no overlay reasons', () => {
      const vm = toCandidateViewModel({
        ...baseCandidate,
        overlayStatus: 'REVIEW',
        overlayReasons: [],
      });
      
      expect(hasOverlayData(vm)).toBe(false);
    });
  });
});
