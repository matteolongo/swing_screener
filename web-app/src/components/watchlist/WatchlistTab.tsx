import { useState, useCallback } from 'react';
import { Loader2, Search, Plus, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useWatchlist } from '../../hooks/useWatchlist';
import { useAIStore } from '../../store/useAIStore';
import { useAppStore } from '../../store/useAppStore';
import WatchlistRow from './WatchlistRow';
import AddSymbolDialog from './AddSymbolDialog';
import AISidePanel from '../ai/AISidePanel';

type SortField = 'symbol' | 'price' | 'change_pct';

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'symbol', label: 'Symbol' },
  { value: 'price', label: 'Price' },
  { value: 'change_pct', label: 'Change %' },
];

export default function WatchlistTab() {
  const {
    items, isLoading, error,
    addWatchlistItem, removeWatchlistItem, runScreenerOnWatchlist,
  } = useWatchlist();
  const setActiveSymbol = useAIStore((s) => s.setActiveSymbol);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [sortBy, setSortBy] = useState<SortField>('symbol');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [screenerLoading, setScreenerLoading] = useState(false);

  const sorted = [...items].sort((a, b) => {
    if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol);
    if (sortBy === 'price') return b.price - a.price;
    return b.change_pct - a.change_pct;
  });

  const handleAddSymbol = useCallback(async (ticker: string) => {
    await addWatchlistItem(ticker);
    setDialogOpen(false);
  }, [addWatchlistItem]);

  const handleRunScreener = useCallback(async () => {
    setScreenerLoading(true);
    const result = await runScreenerOnWatchlist();
    setScreenerLoading(false);
    if (result && result.candidates.length > 0) {
      setActiveTab('screener');
    }
  }, [runScreenerOnWatchlist, setActiveTab]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-surface">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search watchlist..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-border bg-bg-primary text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-accent text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={12} />
          Add
        </button>

        <button
          onClick={handleRunScreener}
          disabled={screenerLoading || items.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-text-secondary hover:text-text-primary hover:border-accent transition-colors disabled:opacity-50"
        >
          {screenerLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          Run Screener on Watchlist
        </button>

        <div className="flex gap-1 ml-auto">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={clsx(
                'px-3 py-1.5 text-xs rounded border transition-colors',
                sortBy === opt.value
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-border text-text-secondary hover:text-text-primary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {error && (
          <div className="px-4 py-3 text-xs text-danger bg-danger/10 border-b border-border">
            {error}
          </div>
        )}

        {isLoading && items.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-secondary text-sm">
            <Loader2 size={16} className="animate-spin mr-2" />
            Loading watchlist...
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-secondary text-sm">
            Your watchlist is empty — add symbols above
          </div>
        )}

        {sorted.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] text-text-secondary uppercase border-b border-border bg-bg-surface sticky top-0">
                <th className="py-2 px-3 font-medium">Symbol</th>
                <th className="py-2 px-3 font-medium">Price</th>
                <th className="py-2 px-3 font-medium">Change %</th>
                <th className="py-2 px-3 font-medium">Setup</th>
                <th className="py-2 px-3 font-medium">R:R</th>
                <th className="py-2 px-3 font-medium">Sector</th>
                <th className="py-2 px-3 font-medium">Held</th>
                <th className="py-2 px-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <WatchlistRow
                  key={item.symbol}
                  item={item}
                  onAnalyze={(symbol) => setActiveSymbol(symbol)}
                  onRemove={(symbol) => removeWatchlistItem(symbol)}
                  onRunScreener={() => setActiveTab('screener')}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dialogOpen && (
        <AddSymbolDialog
          onSelect={handleAddSymbol}
          onClose={() => setDialogOpen(false)}
        />
      )}

      <AISidePanel />
    </div>
  );
}
