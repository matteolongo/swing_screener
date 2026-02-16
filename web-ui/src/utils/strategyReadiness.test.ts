import { describe, it, expect } from 'vitest';
import { isStrategyConfigured, getStrategyReadiness } from './strategyReadiness';
import { DEFAULT_CONFIG } from '@/types/config';
import type { AppConfig } from '@/types/config';

describe('strategyReadiness', () => {
  describe('isStrategyConfigured', () => {
    it('should return false for default config', () => {
      expect(isStrategyConfigured(DEFAULT_CONFIG)).toBe(false);
    });

    it('should return true when account size is customized', () => {
      const customConfig: AppConfig = {
        ...DEFAULT_CONFIG,
        risk: {
          ...DEFAULT_CONFIG.risk,
          accountSize: 100000, // Different from default 50000
        },
      };
      
      expect(isStrategyConfigured(customConfig)).toBe(true);
    });

    it('should return false when account size matches default', () => {
      const config: AppConfig = {
        ...DEFAULT_CONFIG,
        risk: {
          ...DEFAULT_CONFIG.risk,
          accountSize: 50000, // Same as default
          riskPct: 0.02, // Different, but account size is what matters
        },
      };
      
      expect(isStrategyConfigured(config)).toBe(false);
    });
  });

  describe('getStrategyReadiness', () => {
    it('should return not ready for default config', () => {
      const result = getStrategyReadiness(DEFAULT_CONFIG);
      
      expect(result.isReady).toBe(false);
      expect(result.message).toBe('Strategy not configured');
      expect(result.actionRequired.length).toBeGreaterThan(0);
    });

    it('should return ready for customized config', () => {
      const customConfig: AppConfig = {
        ...DEFAULT_CONFIG,
        risk: {
          ...DEFAULT_CONFIG.risk,
          accountSize: 75000,
        },
      };
      
      const result = getStrategyReadiness(customConfig);
      
      expect(result.isReady).toBe(true);
      expect(result.message).toBe('Strategy configured');
      expect(result.actionRequired).toEqual([]);
    });

    it('should include action items when not configured', () => {
      const result = getStrategyReadiness(DEFAULT_CONFIG);
      
      expect(result.actionRequired).toContain('Set your account size in the Strategy page');
    });
  });
});
