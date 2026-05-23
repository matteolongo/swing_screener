import ReactMarkdown from 'react-markdown';
import Badge from '@/components/common/Badge';
import type { SymbolIntelligence, DecisionAction, DecisionConviction } from '@/features/intelligence/types';
import { t } from '@/i18n/t';

function actionLabel(action: DecisionAction): string {
  const map: Record<DecisionAction, string> = {
    BUY_NOW: t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'),
    BUY_ON_PULLBACK: t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback'),
    WAIT_FOR_BREAKOUT: t('workspacePage.panels.analysis.decisionSummary.actions.waitForBreakout'),
    WATCH: t('workspacePage.panels.analysis.decisionSummary.actions.watch'),
    TACTICAL_ONLY: t('workspacePage.panels.analysis.decisionSummary.actions.tacticalOnly'),
    AVOID: t('workspacePage.panels.analysis.decisionSummary.actions.avoid'),
    MANAGE_ONLY: t('workspacePage.panels.analysis.decisionSummary.actions.manageOnly'),
  };
  return map[action];
}

function convictionLabel(conviction: DecisionConviction): string {
  const map: Record<DecisionConviction, string> = {
    high: t('workspacePage.panels.analysis.decisionSummary.conviction.high'),
    medium: t('workspacePage.panels.analysis.decisionSummary.conviction.medium'),
    low: t('workspacePage.panels.analysis.decisionSummary.conviction.low'),
  };
  return map[conviction];
}

function actionVariant(action: DecisionAction): 'primary' | 'success' | 'warning' | 'error' | 'default' {
  if (action === 'BUY_NOW') return 'success';
  if (action === 'AVOID') return 'error';
  if (action === 'BUY_ON_PULLBACK' || action === 'WAIT_FOR_BREAKOUT') return 'primary';
  return 'default';
}

interface IntelligenceCardProps {
  intelligence: SymbolIntelligence;
}

export default function IntelligenceCard({ intelligence }: IntelligenceCardProps) {
  const { action, conviction, summaryLine, narrative, sources } = intelligence;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={actionVariant(action)}>{actionLabel(action)}</Badge>
        <Badge variant="default">{convictionLabel(conviction)}</Badge>
      </div>

      <p className="text-sm text-slate-700 font-medium">{summaryLine}</p>

      <hr className="border-slate-100" />

      <div className="prose prose-sm max-w-none text-slate-800">
        <ReactMarkdown>{narrative}</ReactMarkdown>
      </div>

      {sources.length > 0 && (
        <>
          <hr className="border-slate-100" />
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700 select-none">
              {t('workspacePage.panels.analysis.intelligence.sources')} ({sources.length})
            </summary>
            <ul className="mt-2 space-y-1 list-none pl-0">
              {sources.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all text-xs"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
