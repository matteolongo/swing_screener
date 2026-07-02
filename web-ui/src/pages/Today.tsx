import { useCallback } from 'react';
import ActionInbox from '@/components/domain/today/ActionInbox';
import PositionsMiniCard from '@/components/domain/today/PositionsMiniCard';
import CalendarPeekCard from '@/components/domain/today/CalendarPeekCard';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ─── Today page ──────────────────────────────────────────────────────────────

export default function Today() {
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);

  const handleTickerSelect = useCallback((ticker: string) => {
    setSelectedTicker(ticker, 'screener');
  }, [setSelectedTicker]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="flex flex-col xl:h-[calc(100vh-120px)] min-h-[500px]">
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex-1 overflow-hidden">
            <ActionInbox onTickerSelect={handleTickerSelect} />
          </div>
          <div className="grid shrink-0 gap-3 p-3 md:grid-cols-2">
            <PositionsMiniCard onTickerSelect={handleTickerSelect} />
            <CalendarPeekCard />
          </div>
        </div>
      </div>
    </div>
  );
}
