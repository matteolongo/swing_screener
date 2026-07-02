import { useCallback, useState } from 'react';
import ScreenerPanel from '@/components/domain/screener/ScreenerPanel';
import ActionInbox from '@/components/domain/today/ActionInbox';
import PositionsMiniCard from '@/components/domain/today/PositionsMiniCard';
import CalendarPeekCard from '@/components/domain/today/CalendarPeekCard';
import WatchlistPipelinePanel from '@/components/domain/watchlist/WatchlistPipelinePanel';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';

// ─── Today page ──────────────────────────────────────────────────────────────

type LeftTab = 'today' | 'screener' | 'watchlist';

const LEFT_TAB_LABEL_KEYS: Record<LeftTab, 'todayPage.tabs.today' | 'todayPage.tabs.screener' | 'todayPage.tabs.watchlist'> = {
  today: 'todayPage.tabs.today',
  screener: 'todayPage.tabs.screener',
  watchlist: 'todayPage.tabs.watchlist',
};

export default function Today() {
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);

  const [leftTab, setLeftTab] = useState<LeftTab>('today');

  const handleTickerSelect = useCallback((ticker: string) => {
    setSelectedTicker(ticker, 'screener');
  }, [setSelectedTicker]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-col xl:h-[calc(100vh-120px)] min-h-[500px]">
        {/* Tab bar */}
        <div className="flex border-b border-border shrink-0">
          {(['today', 'screener', 'watchlist'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setLeftTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors capitalize',
                leftTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted hover:text-foreground'
              )}
            >
              {t(LEFT_TAB_LABEL_KEYS[tab])}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {leftTab === 'today' && (
            <div className="flex h-full flex-col overflow-y-auto">
              <div className="flex-1 overflow-hidden">
                <ActionInbox onTickerSelect={handleTickerSelect} />
              </div>
              <div className="grid shrink-0 gap-3 p-3 md:grid-cols-2">
                <PositionsMiniCard onTickerSelect={handleTickerSelect} />
                <CalendarPeekCard />
              </div>
            </div>
          )}
          {leftTab === 'screener' && (
            <ScreenerPanel />
          )}
          {leftTab === 'watchlist' && (
            <div className="h-full overflow-auto px-3 pt-3">
              <WatchlistPipelinePanel onTickerSelect={handleTickerSelect} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
