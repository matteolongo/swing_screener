import type {
  CatalystUrgency,
  PositionSignalAction,
  PriceMoveDirection,
  SymbolIntelligence,
} from '@/features/intelligence/types';
import { t } from '@/i18n/t';

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

function humanizeToken(value: string): string {
  return value.replace(/_/g, ' ');
}

function moveDirectionClass(direction: PriceMoveDirection): string {
  switch (direction) {
    case 'up': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    case 'down': return 'bg-rose-50 border-rose-200 text-rose-800';
    default: return 'bg-slate-50 border-slate-200 text-slate-700';
  }
}

const MOVE_DIRECTION_ARROW: Record<PriceMoveDirection, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

function moveDirectionLabel(direction: PriceMoveDirection): string {
  return t(`workspacePage.panels.analysis.intelligence.positionMove.direction.${direction}`);
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
    catalystUrgency, upcomingEvents, positionSignal, positionOutlook,
    positionMoveExplanation, sources,
  } = intelligence;
  const hasUrgency = catalystUrgency !== 'none';
  const hasEvents = upcomingEvents.length > 0;
  const hasSources = sources.length > 0;
  const hasPositionOutlook = Boolean(positionOutlook);
  const hasMoveExplanation = Boolean(positionMoveExplanation);

  if (!hasUrgency && !positionSignal && !hasMoveExplanation && !hasPositionOutlook && !hasEvents && !hasSources) {
    return null;
  }

  const urgencyLabel = t(`workspacePage.panels.analysis.intelligence.catalystUrgency.${catalystUrgency}`);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      {hasUrgency && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${urgencyBadgeClass(catalystUrgency)}`}>
            {urgencyLabel}
          </span>
        </div>
      )}

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

      {positionMoveExplanation && (
        <>
          <hr className="border-slate-100" />
          <div className={`rounded-lg border px-3 py-2 ${moveDirectionClass(positionMoveExplanation.direction)}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide">
                {t('workspacePage.panels.analysis.intelligence.positionMove.title')}
              </span>
              <span className="text-sm font-semibold">
                {MOVE_DIRECTION_ARROW[positionMoveExplanation.direction]} {moveDirectionLabel(positionMoveExplanation.direction)}
              </span>
            </div>
            <p className="text-sm mt-1">{positionMoveExplanation.summary}</p>
            {positionMoveExplanation.drivers.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                {positionMoveExplanation.drivers.map((driver, index) => (
                  <li key={`${driver.label}-${index}`}>
                    <span className="font-medium">{driver.label}:</span> {driver.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {positionOutlook && (
        <>
          <hr className="border-slate-100" />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('workspacePage.panels.analysis.intelligence.positionOutlook.title')}
            </p>
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <div>
                <span className="text-xs font-medium text-slate-500">
                  {t('workspacePage.panels.analysis.intelligence.positionOutlook.expectedHoldingPeriod')}
                </span>
                <p className="font-medium text-slate-900">{humanizeToken(positionOutlook.expectedHoldingPeriod)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">
                  {t('workspacePage.panels.analysis.intelligence.positionOutlook.thesisStatus')}
                </span>
                <p className="font-medium text-slate-900">{humanizeToken(positionOutlook.thesisStatus)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">
                  {t('workspacePage.panels.analysis.intelligence.positionOutlook.profitManagement')}
                </span>
                <p className="font-medium text-slate-900">{humanizeToken(positionOutlook.profitManagement)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500">
                  {t('workspacePage.panels.analysis.intelligence.positionOutlook.opportunityCost')}
                </span>
                <p className="font-medium text-slate-900">{humanizeToken(positionOutlook.opportunityCost)}</p>
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('workspacePage.panels.analysis.intelligence.positionOutlook.holdUntil')}
                </dt>
                <dd className="text-slate-700">{positionOutlook.holdUntil}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('workspacePage.panels.analysis.intelligence.positionOutlook.nextReviewTrigger')}
                </dt>
                <dd className="text-slate-700">{positionOutlook.nextReviewTrigger}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {t('workspacePage.panels.analysis.intelligence.positionOutlook.confidenceDecay')}
                </dt>
                <dd className="text-slate-700">{positionOutlook.confidenceDecay}</dd>
              </div>
            </dl>
            {positionOutlook.invalidationSignals.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {t('workspacePage.panels.analysis.intelligence.positionOutlook.invalidationSignals')}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
                  {positionOutlook.invalidationSignals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      {hasEvents && (
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

      {hasSources && (
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
