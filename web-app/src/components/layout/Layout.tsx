import { useAppStore } from '../../store/useAppStore';
import ScreenerTab from '../screener/ScreenerTab';
import WatchlistTab from '../watchlist/WatchlistTab';

export default function Layout() {
  const { activeTab } = useAppStore();

  if (activeTab === 'screener') return <ScreenerTab />;
  if (activeTab === 'watchlist') return <WatchlistTab />;

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <p className="text-text-secondary">{activeTab} — coming soon</p>
    </main>
  );
}
