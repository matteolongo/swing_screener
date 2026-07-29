import { useAppStore } from '../../store/useAppStore';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import ScreenerTab from '../screener/ScreenerTab';
import WatchlistTab from '../watchlist/WatchlistTab';
import AITab from '../ai/AITab';
import DailyReviewTab from '../dailyreview/DailyReviewTab';
import PositionDetailPanel from '../positions/PositionDetailPanel';
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
