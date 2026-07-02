import { describe, it, expect } from 'vitest'
import {
  freshnessBadge,
  decisionActionBadge,
  convictionBadge,
  exhaustionBadge,
  positionSignalBadge,
  orderReviewBadge,
  thesisDeltaBadge,
  jobStatusBadge,
  probeTone,
} from './badgeMap';

describe('badgeMap', () => {
  it('freshness: final_close is success, intraday is warning', () => {
    expect(freshnessBadge('final_close').variant).toBe('success');
    expect(freshnessBadge('intraday').variant).toBe('warning');
  });

  it('decision actions: buys are primary, avoid/manage are default', () => {
    expect(decisionActionBadge('BUY_NOW').variant).toBe('primary');
    expect(decisionActionBadge('BUY_ON_PULLBACK').variant).toBe('primary');
    expect(decisionActionBadge('AVOID').variant).toBe('default');
    expect(decisionActionBadge('MANAGE_ONLY').variant).toBe('default');
  });

  it('conviction: high is primary', () => {
    expect(convictionBadge('high').variant).toBe('primary');
  });

  it('attention states map to warning, terminal-bad to error', () => {
    expect(exhaustionBadge('watch').variant).toBe('warning');
    expect(exhaustionBadge('exit').variant).toBe('error');
    expect(positionSignalBadge('TRIM').variant).toBe('warning');
    expect(positionSignalBadge('EXIT').variant).toBe('error');
    expect(orderReviewBadge('stale').variant).toBe('warning');
    expect(thesisDeltaBadge('invalidated').variant).toBe('error');
  });

  it('job status: running is primary, error is error', () => {
    expect(jobStatusBadge('running').variant).toBe('primary');
    expect(jobStatusBadge('error').variant).toBe('error');
    expect(jobStatusBadge('completed').variant).toBe('success');
  });

  it('probe status maps to StatusDot tones', () => {
    expect(probeTone('ok')).toBe('ok');
    expect(probeTone('degraded')).toBe('warn');
    expect(probeTone('down')).toBe('down');
    expect(probeTone('not_configured')).toBe('idle');
  });

  it('every spec carries an i18n labelKey', () => {
    expect(freshnessBadge('final_close').labelKey).toBeTruthy();
    expect(decisionActionBadge('WATCH').labelKey).toBeTruthy();
  });
});
