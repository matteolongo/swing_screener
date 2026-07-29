import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Search, Info } from 'lucide-react';
import { useAIConsole } from '../../hooks/useAIConsole';
import { usePortfolioStore } from '../../store/usePortfolioStore';
import { useAppStore } from '../../store/useAppStore';
import { getSymbolPool } from '../../services/api/screenerApi';
import type { PoolSymbol } from '@/types/api';
import AnalysisHistory from './AnalysisHistory';
import IntelligencePanel from './IntelligencePanel';
import ChatPanel from './ChatPanel';
import PositionReview from './PositionReview';

const TIME_RANGES = ['1h', '4h', '12h', '24h', 'All'] as const;

export default function AITab() {
  const {
    selectedSymbol, historyEntries, latestAnalysis, chatMessages,
    isLoading, error, setSelectedSymbol, sendChatMessage, forceRefresh,
  } = useAIConsole();

  const positions = usePortfolioStore((s) => s.positions);
  const mode = useAppStore((s) => s.mode);
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<PoolSymbol[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [timeRange, setTimeRange] = useState<string>(mode === 'intraday' ? '4h' : 'All');
  const searchRef = useRef<HTMLDivElement>(null);

  const matchedPosition = selectedSymbol
    ? positions.find((p) => p.ticker === selectedSymbol)
    : null;

  useEffect(() => {
    if (!searchInput.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await getSymbolPool({ symbol: searchInput.toUpperCase() });
        setSuggestions(res.symbols.slice(0, 10));
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = useCallback((symbol: string) => {
    setSearchInput(symbol);
    setShowSuggestions(false);
    setSelectedSymbol(symbol);
  }, [setSelectedSymbol]);

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      const val = searchInput.trim().toUpperCase();
      if (val) {
        setSelectedSymbol(val);
        setShowSuggestions(false);
      }
    }
  }

  const filteredEntries = timeRange === 'All'
    ? historyEntries
    : historyEntries.filter((e) => {
      const hours = (Date.now() - new Date(e.generated_at).getTime()) / 3600000;
      const map: Record<string, number> = { '1h': 1, '4h': 4, '12h': 12, '24h': 24 };
      return hours <= (map[timeRange] ?? Infinity);
    });

  return (
    <main className="mx-auto max-w-7xl px-6 py-6 flex flex-col gap-4 h-full">
      {mode === 'intraday' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded bg-accent/5 border border-accent/20 text-xs text-text-secondary">
          <Info size={14} className="text-accent shrink-0" />
          Showing intraday intelligence (live data, not final close).
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <div ref={searchRef} className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search symbol..."
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded z-50 max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.symbol}
                  onClick={() => handleSelectSuggestion(s.symbol)}
                  className="w-full px-3 py-2 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-2"
                >
                  <span className="font-medium">{s.symbol}</span>
                  {s.exchange_mic && (
                    <span className="text-[var(--text-secondary)]">{s.exchange_mic}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={forceRefresh}
          disabled={!selectedSymbol || isLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Force Refresh
        </button>

        <div className="flex items-center gap-1 bg-[var(--bg-surface)] rounded border border-[var(--border)]">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded transition-colors ${
                timeRange === r
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {error && (
          <span className="text-xs text-[var(--danger)]">{error}</span>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex-1 overflow-y-auto">
            <AnalysisHistory
              entries={filteredEntries}
              onSelect={(entry) => {
                if (entry) {}
              }}
              isLoading={isLoading && historyEntries.length === 0}
            />
          </div>
          <div className="h-64 shrink-0">
            <ChatPanel
              messages={chatMessages}
              onSend={sendChatMessage}
              disabled={!selectedSymbol || isLoading}
            />
          </div>
        </div>
        <div className="w-80 shrink-0 overflow-y-auto">
          <IntelligencePanel
            analysis={latestAnalysis}
            isLoading={isLoading && !latestAnalysis}
          />
        </div>
      </div>

      {matchedPosition && (
        <div className="shrink-0">
          <PositionReview
            positionId={matchedPosition.position_id}
            symbol={selectedSymbol!}
          />
        </div>
      )}
    </main>
  );
}
