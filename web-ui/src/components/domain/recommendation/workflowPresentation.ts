import type { ScreenerCandidate } from '@/features/screener/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';
import type {
  Recommendation,
  WorkflowNextStep,
  WorkflowStatus,
} from '@/types/recommendation';
import { normalizeWorkflowNextStep, normalizeWorkflowStatus } from '@/types/recommendation';
import { normalizeSuggestedOrderType } from '@/features/orders/executionDefaults';
import { formatCurrency } from '@/utils/formatters';

export type WorkflowTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface WorkflowPresentation {
  status: WorkflowStatus;
  labelKey: MessageKey;
  groupTitleKey: MessageKey;
  groupDescriptionKey: MessageKey;
  tone: WorkflowTone;
}

const PRESENTATIONS: Record<WorkflowStatus, WorkflowPresentation> = {
  ready: {
    status: 'ready',
    labelKey: 'recommendation.workflow.status.ready',
    groupTitleKey: 'screener.workflowGroups.ready.title',
    groupDescriptionKey: 'screener.workflowGroups.ready.description',
    tone: 'success',
  },
  waiting_trigger: {
    status: 'waiting_trigger',
    labelKey: 'recommendation.workflow.status.waitingTrigger',
    groupTitleKey: 'screener.workflowGroups.waitingTrigger.title',
    groupDescriptionKey: 'screener.workflowGroups.waitingTrigger.description',
    tone: 'warning',
  },
  needs_review: {
    status: 'needs_review',
    labelKey: 'recommendation.workflow.status.needsReview',
    groupTitleKey: 'screener.workflowGroups.needsReview.title',
    groupDescriptionKey: 'screener.workflowGroups.needsReview.description',
    tone: 'danger',
  },
  no_setup: {
    status: 'no_setup',
    labelKey: 'recommendation.workflow.status.noSetup',
    groupTitleKey: 'screener.workflowGroups.noSetup.title',
    groupDescriptionKey: 'screener.workflowGroups.noSetup.description',
    tone: 'neutral',
  },
};

export const WORKFLOW_ORDER: WorkflowStatus[] = [
  'ready',
  'waiting_trigger',
  'needs_review',
  'no_setup',
];

export function getWorkflowPresentation(
  recommendation?: Pick<Recommendation, 'workflowStatus'>,
): WorkflowPresentation {
  return PRESENTATIONS[normalizeWorkflowStatus(recommendation?.workflowStatus)];
}

export function canReviewPendingPullbackOrder(context: {
  approvalToken?: string;
  suggestedOrderType?: string | null;
  recommendation?: Pick<Recommendation, 'workflowStatus' | 'nextStep'> | null;
}): boolean {
  const suggestedOrderType = normalizeSuggestedOrderType(context.suggestedOrderType);
  return Boolean(
    context.approvalToken
    && suggestedOrderType === 'BUY_LIMIT'
    && context.recommendation?.workflowStatus === 'waiting_trigger'
    && context.recommendation.nextStep.code === 'wait_pullback',
  );
}

export function formatWorkflowNextStep(nextStep?: WorkflowNextStep): string {
  const safeStep = normalizeWorkflowNextStep(nextStep);
  if (safeStep.code === 'wait_pullback' || safeStep.code === 'wait_breakout_close') {
    if (safeStep.triggerPrice == null || !safeStep.currency) {
      return t('recommendation.workflow.nextStep.refresh_data');
    }
    const price = formatCurrency(safeStep.triggerPrice, safeStep.currency);
    return safeStep.code === 'wait_pullback'
      ? t('recommendation.workflow.nextStep.wait_pullback', { price })
      : t('recommendation.workflow.nextStep.wait_breakout_close', { price });
  }
  return t(`recommendation.workflow.nextStep.${safeStep.code}` as MessageKey);
}

export function groupCandidatesByWorkflow(candidates: ScreenerCandidate[]) {
  return WORKFLOW_ORDER.map((status) => ({
    status,
    presentation: PRESENTATIONS[status],
    candidates: candidates.filter(
      (candidate) => normalizeWorkflowStatus(candidate.recommendation?.workflowStatus) === status,
    ),
  }));
}
