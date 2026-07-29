import { useAppStore } from '@/store/useAppStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import ScreenerTab from '@/components/screener/ScreenerTab';
import WatchlistTab from '@/components/watchlist/WatchlistTab';
import AITab from '@/components/ai/AITab';
import DailyReviewTab from '@/components/dailyreview/DailyReviewTab';
import PositionDetailPanel from '@/components/positions/PositionDetailPanel';
import SettingsDrawer from './SettingsDrawer';
import IntradayBanner from './IntradayBanner';

export default function Layout() {
  const activeTab = useAppStore((s) => s.activeTab);
  const selectedPositionId = usePortfolioStore((s) => s.selectedPositionId);
  const setSelectedPositionId = usePortfolioStore((s) => s.setSelectedPositionId);

  return (
    <>
      <IntradayBanner />
      {activeTab === 'screener' && <ScreenerTab />}
      {activeTab === 'watchlist' && <WatchlistTab />}
      {activeTab === 'ai' && <AITab />}
      {activeTab === 'daily-review' && <DailyReviewTab />}
      {selectedPositionId && (
        <PositionDetailPanel
          positionId={selectedPositionId}
          onClose={() => setSelectedPositionId(null)}
        />
      )}
      <SettingsDrawer />
    </>
  );
}
