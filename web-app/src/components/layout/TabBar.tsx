import { BarChart3, Eye, Brain, ClipboardList } from 'lucide-react';
import { useAppStore, type TabId } from '../../store/useAppStore';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'screener', label: 'Screener', icon: <BarChart3 size={16} /> },
  { id: 'watchlist', label: 'Watchlist', icon: <Eye size={16} /> },
  { id: 'ai', label: 'AI', icon: <Brain size={16} /> },
  { id: 'daily-review', label: 'Daily Review', icon: <ClipboardList size={16} /> },
];

export default function TabBar() {
  const { activeTab, setActiveTab, mode, setMode } = useAppStore();

  return (
    <div className="flex items-center border-b border-border px-4">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-accent text-accent bg-bg-elevated'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center">
        <button
          onClick={() => setMode(mode === 'eod' ? 'intraday' : 'eod')}
          className="px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          {mode === 'eod' ? 'End-of-Day' : 'Intraday'}
        </button>
      </div>
    </div>
  );
}
