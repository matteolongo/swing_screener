import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import type { DecisionAction } from '@/features/screener/types';

const ACTION_LABEL_KEYS: Record<DecisionAction, MessageKey> = {
  BUY_NOW: 'workspacePage.panels.analysis.decisionSummary.actions.buyNow',
  BUY_ON_PULLBACK: 'workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback',
  WAIT_FOR_BREAKOUT: 'workspacePage.panels.analysis.decisionSummary.actions.waitForBreakout',
  WATCH: 'workspacePage.panels.analysis.decisionSummary.actions.watch',
  TACTICAL_ONLY: 'workspacePage.panels.analysis.decisionSummary.actions.tacticalOnly',
  AVOID: 'workspacePage.panels.analysis.decisionSummary.actions.avoid',
  MANAGE_ONLY: 'workspacePage.panels.analysis.decisionSummary.actions.manageOnly',
};

/** Human-readable, i18n-backed label for a decision action (e.g. "Buy on Pullback"). */
export function formatDecisionAction(action: DecisionAction): string {
  return t(ACTION_LABEL_KEYS[action]);
}
