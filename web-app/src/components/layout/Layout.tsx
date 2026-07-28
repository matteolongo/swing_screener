import { useAppStore } from '../../store/useAppStore';

const tabContent: Record<string, string> = {
  screener: 'Screener — coming soon',
  watchlist: 'Watchlist — coming soon',
  ai: 'AI — coming soon',
  'daily-review': 'Daily Review — coming soon',
};

export default function Layout() {
  const { activeTab } = useAppStore();

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <p className="text-text-secondary">{tabContent[activeTab]}</p>
    </main>
  );
}
