import type { MessageKey } from '@/i18n/types';

export type SetupSignal = 'breakout' | 'pullback' | 'both' | 'unknown';

export interface SetupExecutionGuidance {
  signal: SetupSignal;
  setupLabelKey: MessageKey;
  whatItMeansKey: MessageKey;
  stepsKeys: [MessageKey, MessageKey, MessageKey];
  cautionKey: MessageKey;
}

export function normalizeSetupSignal(signal?: string | null): SetupSignal {
  const normalized = String(signal ?? '').trim().toLowerCase();
  if (normalized === 'breakout' || normalized === 'buy_now' || normalized === 'wait_for_breakout') return 'breakout';
  if (normalized === 'pullback' || normalized === 'buy_on_pullback') return 'pullback';
  if (normalized === 'both') return 'both';
  return 'unknown';
}

export function getSetupExecutionGuidance(signal?: string | null): SetupExecutionGuidance {
  const normalized = normalizeSetupSignal(signal);

  if (normalized === 'breakout') {
    return {
      signal: normalized,
      setupLabelKey: 'order.setupGuidance.signals.breakout.label',
      whatItMeansKey: 'order.setupGuidance.signals.breakout.whatItMeans',
      stepsKeys: [
        'order.setupGuidance.signals.breakout.steps.step1',
        'order.setupGuidance.signals.breakout.steps.step2',
        'order.setupGuidance.signals.breakout.steps.step3',
      ],
      cautionKey: 'order.setupGuidance.signals.breakout.caution',
    };
  }

  if (normalized === 'pullback') {
    return {
      signal: normalized,
      setupLabelKey: 'order.setupGuidance.signals.pullback.label',
      whatItMeansKey: 'order.setupGuidance.signals.pullback.whatItMeans',
      stepsKeys: [
        'order.setupGuidance.signals.pullback.steps.step1',
        'order.setupGuidance.signals.pullback.steps.step2',
        'order.setupGuidance.signals.pullback.steps.step3',
      ],
      cautionKey: 'order.setupGuidance.signals.pullback.caution',
    };
  }

  if (normalized === 'both') {
    return {
      signal: normalized,
      setupLabelKey: 'order.setupGuidance.signals.both.label',
      whatItMeansKey: 'order.setupGuidance.signals.both.whatItMeans',
      stepsKeys: [
        'order.setupGuidance.signals.both.steps.step1',
        'order.setupGuidance.signals.both.steps.step2',
        'order.setupGuidance.signals.both.steps.step3',
      ],
      cautionKey: 'order.setupGuidance.signals.both.caution',
    };
  }

  return {
    signal: 'unknown',
    setupLabelKey: 'order.setupGuidance.signals.unknown.label',
    whatItMeansKey: 'order.setupGuidance.signals.unknown.whatItMeans',
    stepsKeys: [
      'order.setupGuidance.signals.unknown.steps.step1',
      'order.setupGuidance.signals.unknown.steps.step2',
      'order.setupGuidance.signals.unknown.steps.step3',
    ],
    cautionKey: 'order.setupGuidance.signals.unknown.caution',
  };
}
