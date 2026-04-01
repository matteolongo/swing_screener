import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import FloatingChatWidget from '@/components/domain/workspace/FloatingChatWidget';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import { useSymbolIntelligenceRunner } from '@/features/intelligence/useSymbolIntelligenceRunner';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useDailyReview } from '@/features/dailyReview/api';
import {
  parseUniverseFromStorage,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import { formatNumber } from '@/utils/formatters';
import type {
  DailyReviewCandidate,
  DailyReviewPositionClose,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
} from '@/features/dailyReview/types';

// ─── Action item row components ─────────────────────────────────────────────

interface CloseItemProps {
  item: DailyReviewPositionClose;
  onClick: (ticker: string) => void;
}

function CloseItem({ item, onClick }: CloseItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-red-500"
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        {t('todayPage.actionList.close')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', item.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{item.reason}</span>
    </button>
  );
}

interface UpdateStopItemProps {
  item: DailyReviewPositionUpdate;
  onClick: (ticker: string) => void;
}

function UpdateStopItem({ item, onClick }: UpdateStopItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-amber-500"
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {t('todayPage.actionList.updateStop')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', item.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{item.reason}</span>
    </button>
  );
}

interface CandidateItemProps {
  item: DailyReviewCandidate;
  isAddOn?: boolean;
  onClick: (ticker: string) => void;
}

function CandidateItem({ item, isAddOn, onClick }: CandidateItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-blue-500"
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      {isAddOn ? (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
          {t('todayPage.actionList.addOn')}
        </span>
      ) : (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {item.decisionSummary?.action ?? item.signal}
        </span>
      )}
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        r/r: {formatNumber(item.rReward, 2)}R
      </span>
      {item.name && (
        <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{item.name}</span>
      )}
    </button>
  );
}

interface HoldItemProps {
  item: DailyReviewPositionHold;
  onClick: (ticker: string) => void;
}

function HoldItem({ item, onClick }: HoldItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-gray-300 dark:border-gray-600"
    >
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        {t('dailyReview.table.hold.holdBadge')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', item.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{item.reason}</span>
    </button>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  count: number;
  colorClass: string;
  expanded: boolean;
  onToggle: () => void;
}

function SectionHeader({ label, count, colorClass, expanded, onToggle }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-center justify-between px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide',
        colorClass
      )}
    >
      <span>{label}</span>
      <span className="font-bold">{count} {expanded ? '▲' : '▼'}</span>
    </button>
  );
}

// ─── Today action list panel ─────────────────────────────────────────────────

interface TodayActionListProps {
  onTickerSelect: (ticker: string) => void;
}

function TodayActionList({ onTickerSelect }: TodayActionListProps) {
  const selectedUniverse = parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY));
  const { data: review, isLoading, error, refetch, isFetching } = useDailyReview(200, selectedUniverse);

  const [holdExpanded, setHoldExpanded] = useState(false);

  const requiresActionCount =
    (review?.positionsClose.length ?? 0) + (review?.positionsUpdateStop.length ?? 0);
  const opportunitiesCount =
    (review?.newCandidates.length ?? 0) + (review?.positionsAddOnCandidates.length ?? 0);
  const holdCount = review?.positionsHold.length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-gray-500 dark:text-gray-400">
        {t('todayPage.actionList.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 text-sm text-red-600 dark:text-red-400">
        {t('dailyReview.header.error', { message: error instanceof Error ? error.message : t('dailyReview.header.unknownError') })}
      </div>
    );
  }

  const isEmpty = requiresActionCount === 0 && opportunitiesCount === 0 && holdCount === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {review && (
            <>
              <span className="text-xs text-gray-500 dark:text-gray-400">{review.summary.reviewDate}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          title={t('dailyReview.header.refreshTitle')}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
        </button>
      </div>

      {/* Summary chips */}
      {review && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border shrink-0">
          {review.summary.newCandidates > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
              {t('dailyReviewBanner.newCandidates', { n: String(review.summary.newCandidates) })}
            </span>
          )}
          {review.summary.updateStop > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
              {t('dailyReviewBanner.stopsToUpdate', { n: String(review.summary.updateStop) })}
            </span>
          )}
          {review.summary.closePositions > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
              {t('dailyReviewBanner.positionsToClose', { n: String(review.summary.closePositions) })}
            </span>
          )}
        </div>
      )}

      {/* Action list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {isEmpty && (
          <p className="text-sm text-gray-500 dark:text-gray-400 px-2 py-4 text-center">
            {t('todayPage.actionList.empty')}
          </p>
        )}

        {/* Requires Action section */}
        {requiresActionCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded">
              {t('todayPage.actionList.requiresAction')} · {requiresActionCount}
            </div>
            <div className="space-y-0.5">
              {review?.positionsClose.map((item) => (
                <CloseItem key={item.positionId} item={item} onClick={onTickerSelect} />
              ))}
              {review?.positionsUpdateStop.map((item) => (
                <UpdateStopItem key={item.positionId} item={item} onClick={onTickerSelect} />
              ))}
            </div>
          </div>
        )}

        {/* New Opportunities section */}
        {opportunitiesCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded">
              {t('todayPage.actionList.opportunities')} · {opportunitiesCount}
            </div>
            <div className="space-y-0.5">
              {review?.newCandidates.map((item) => (
                <CandidateItem key={item.ticker} item={item} onClick={onTickerSelect} />
              ))}
              {review?.positionsAddOnCandidates.map((item) => (
                <CandidateItem key={item.ticker} item={item} isAddOn onClick={onTickerSelect} />
              ))}
            </div>
          </div>
        )}

        {/* Holding section (collapsed by default) */}
        {holdCount > 0 && (
          <div className="space-y-1">
            <SectionHeader
              label={t('todayPage.actionList.holding')}
              count={holdCount}
              colorClass="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700/50"
              expanded={holdExpanded}
              onToggle={() => setHoldExpanded((v) => !v)}
            />
            {holdExpanded && (
              <div className="space-y-0.5">
                {review?.positionsHold.map((item) => (
                  <HoldItem key={item.positionId} item={item} onClick={onTickerSelect} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Today page ──────────────────────────────────────────────────────────────

type LeftTab = 'today' | 'screener';
type TabletTab = 'left' | 'analysis';

export default function Today() {
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const { runForTicker, getStatusForTicker } = useSymbolIntelligenceRunner();
  const selectedTickerIntelligenceStatus = selectedTicker ? getStatusForTicker(selectedTicker) : undefined;

  const [leftTab, setLeftTab] = useState<LeftTab>('today');
  const [activeTablet, setActiveTablet] = useState<TabletTab>('left');
  const prevTickerRef = useRef<string | null>(null);

  // On narrow screens, auto-switch to analysis panel when a symbol is selected
  useEffect(() => {
    if (selectedTicker && selectedTicker !== prevTickerRef.current) {
      prevTickerRef.current = selectedTicker;
      setActiveTablet('analysis');
    }
  }, [selectedTicker]);

  const handleTickerSelect = (ticker: string) => {
    setSelectedTicker(ticker, 'screener');
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Tablet tab switcher — only visible below xl breakpoint */}
      <div className="xl:hidden flex border-b border-border mb-3">
        {(['left', 'analysis'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTablet(tab)}
            className={cn(
              'flex-1 py-2 text-sm font-medium capitalize transition-colors',
              activeTablet === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            )}
          >
            {tab === 'left' ? t('todayPage.tabs.today') : t('workspacePage.panels.analysis.title')}
          </button>
        ))}
      </div>

      <div className="flex gap-4 xl:h-[calc(100vh-120px)] min-h-[500px]">
        {/* Left panel */}
        <div
          className={cn(
            'min-w-0 flex flex-col xl:overflow-hidden xl:w-7/12',
            activeTablet === 'left' ? 'w-full' : 'hidden xl:flex'
          )}
        >
          {/* Left panel tab bar */}
          <div className="flex border-b border-border shrink-0">
            {(['today', 'screener'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLeftTab(tab)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors capitalize',
                  leftTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                )}
              >
                {tab === 'today' ? t('todayPage.tabs.today') : t('todayPage.tabs.screener')}
              </button>
            ))}
          </div>

          {/* Left panel content */}
          <div className="flex-1 overflow-hidden">
            {leftTab === 'today' && (
              <TodayActionList onTickerSelect={handleTickerSelect} />
            )}
            {leftTab === 'screener' && (
              <ScreenerInboxPanel />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div
          className={cn(
            'min-w-0 flex flex-col xl:overflow-hidden xl:w-5/12',
            activeTablet === 'analysis' ? 'w-full' : 'hidden xl:flex'
          )}
        >
          <AnalysisCanvasPanel
            onRunSymbolIntelligence={runForTicker}
            symbolIntelligenceStatus={selectedTickerIntelligenceStatus}
          />
        </div>
      </div>

      <FloatingChatWidget />
    </div>
  );
}
