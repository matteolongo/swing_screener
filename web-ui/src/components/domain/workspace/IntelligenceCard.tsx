import Badge from '@/components/common/Badge';
import type {
  CatalystUrgency,
  DecisionAction,
  DecisionConviction,
  PositionSignalAction,
  SymbolIntelligence,
} from '@/features/intelligence/types';
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

function urgencyBadgeClass(urgency: CatalystUrgency): string {
  switch (urgency) {
    case 'high': return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low': return 'bg-slate-100 text-slate-600 border-slate-200';
    default: return '';
  }
}

function positionSignalClass(action: PositionSignalAction): string {
  switch (action) {
    case 'EXIT': return 'bg-rose-50 border-rose-200 text-rose-800';
    case 'TRIM': return 'bg-amber-50 border-amber-200 text-amber-800';
    default: return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  }
}

function positionSignalLabel(action: PositionSignalAction): string {
  switch (action) {
    case 'HOLD': return t('workspacePage.panels.analysis.intelligence.positionSignal.hold');
    case 'TRIM': return t('workspacePage.panels.analysis.intelligence.positionSignal.trim');
    case 'EXIT': return t('workspacePage.panels.analysis.intelligence.positionSignal.exit');
  }
}

const DIRECTION_ARROW: Record<string, string> = {
  bullish: '↑',
  bearish: '↓',
  neutral: '→',
};

interface IntelligenceCardProps {
  intelligence: SymbolIntelligence;
}

export default function IntelligenceCard({ intelligence }: IntelligenceCardProps) {
  const {
    action, conviction, catalystUrgency, summaryLine,
    narrative, upcomingEvents, positionSignal, sources,
  } = intelligence;

  const urgencyLabel = t(`workspacePage.panels.analysis.intelligence.catalystUrgency.${catalystUrgency}`);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={actionVariant(action)}>{actionLabel(action)}</Badge>
        <Badge variant="default">{convictionLabel(conviction)}</Badge>
        {catalystUrgency !== 'none' && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${urgencyBadgeClass(catalystUrgency)}`}>
            {urgencyLabel}
          </span>
        )}
      </div>

      <p className="text-sm text-slate-700 font-medium">{summaryLine}</p>

      <hr className="border-slate-100" />

      <p className="text-sm text-slate-800 whitespace-pre-wrap">{narrative}</p>

      {positionSignal && (
        <>
          <hr className="border-slate-100" />
          <div className={`rounded-lg border px-3 py-2 ${positionSignalClass(positionSignal.action)}`}>
            <span className="text-xs font-semibold uppercase tracking-wide mr-2">
              {positionSignalLabel(positionSignal.action)}
            </span>
            <span className="text-sm">{positionSignal.reason}</span>
          </div>
        </>
      )}

      {upcomingEvents.length > 0 && (
        <>
          <hr className="border-slate-100" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
              {t('workspacePage.panels.analysis.intelligence.upcomingEvents')}
            </p>
            <ul className="space-y-1">
              {upcomingEvents.map((ev, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                    {ev.type}
                  </span>
                  <span className="text-slate-500 shrink-0">
                    {DIRECTION_ARROW[ev.direction] ?? '→'}
                  </span>
                  <span>
                    <span>{ev.summary}</span>
                    {ev.date && <span className="text-slate-400 ml-1">({ev.date})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

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
