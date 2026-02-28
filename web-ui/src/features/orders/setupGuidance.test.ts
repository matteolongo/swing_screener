import { describe, expect, it } from 'vitest';
import { getSetupExecutionGuidance, normalizeSetupSignal } from '@/features/orders/setupGuidance';

describe('setup guidance mapper', () => {
  it('normalizes known setup signals', () => {
    expect(normalizeSetupSignal('breakout')).toBe('breakout');
    expect(normalizeSetupSignal('PULLBACK')).toBe('pullback');
    expect(normalizeSetupSignal(' both ')).toBe('both');
  });

  it('maps unknown setup signals to fallback', () => {
    expect(normalizeSetupSignal('')).toBe('unknown');
    expect(normalizeSetupSignal('mean_reversion')).toBe('unknown');
    expect(normalizeSetupSignal(undefined)).toBe('unknown');
  });

  it('returns breakout-specific guidance', () => {
    const guidance = getSetupExecutionGuidance('breakout');
    expect(guidance.signal).toBe('breakout');
    expect(guidance.setupLabelKey).toBe('order.setupGuidance.signals.breakout.label');
    expect(guidance.stepsKeys[0]).toBe('order.setupGuidance.signals.breakout.steps.step1');
  });

  it('returns pullback-specific guidance', () => {
    const guidance = getSetupExecutionGuidance('pullback');
    expect(guidance.signal).toBe('pullback');
    expect(guidance.setupLabelKey).toBe('order.setupGuidance.signals.pullback.label');
    expect(guidance.stepsKeys[0]).toBe('order.setupGuidance.signals.pullback.steps.step1');
  });

  it('returns deterministic fallback for both and unknown setup values', () => {
    const bothGuidance = getSetupExecutionGuidance('both');
    expect(bothGuidance.signal).toBe('both');
    expect(bothGuidance.setupLabelKey).toBe('order.setupGuidance.signals.both.label');

    const unknownGuidance = getSetupExecutionGuidance('something_else');
    expect(unknownGuidance.signal).toBe('unknown');
    expect(unknownGuidance.setupLabelKey).toBe('order.setupGuidance.signals.unknown.label');
  });
});
