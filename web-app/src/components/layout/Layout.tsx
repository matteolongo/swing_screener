import { useAppStore } from '../../store/useAppStore';
import ScreenerTab from '../screener/ScreenerTab';
import WatchlistTab from '../watchlist/WatchlistTab';
import AITab from '../ai/AITab';
import DailyReviewTab from '../dailyreview/DailyReviewTab';

export default function Layout() {
  const { activeTab } = useAppStore();

  if (activeTab === 'screener') return <ScreenerTab />;
  if (activeTab === 'watchlist') return <WatchlistTab />;
  if (activeTab === 'ai') return <AITab />;
  if (activeTab === 'daily-review') return <DailyReviewTab />;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <p className="text-text-secondary">{activeTab} — coming soon</p>
    </main>
  );
}
