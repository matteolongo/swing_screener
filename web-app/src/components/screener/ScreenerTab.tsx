import { Loader2 } from 'lucide-react';
import { useScreener } from '../../hooks/useScreener';
import { useAIStore } from '../../store/useAIStore';
import UniverseSelector from './UniverseSelector';
import PresetFilter from './PresetFilter';
import SortControls from './SortControls';
import CandidateRow from './CandidateRow';
import AISidePanel from '../ai/AISidePanel';

export default function ScreenerTab() {
  const { candidates, isLoading, error, refetch } = useScreener();
  const setActiveSymbol = useAIStore((s) => s.setActiveSymbol);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-surface">
        <UniverseSelector />
        <PresetFilter />
        <SortControls />
        <button
          onClick={refetch}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading && <Loader2 size={12} className="animate-spin" />}
          Run
        </button>
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-success/20 text-success ml-auto">
          final_close
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {error && (
          <div className="px-4 py-3 text-xs text-danger bg-danger/10 border-b border-border">
            {error}
          </div>
        )}

        {!isLoading && candidates.length === 0 && (
          <div className="flex items-center justify-center h-32 text-text-secondary text-sm">
            No candidates found — adjust filters and run the screener.
          </div>
        )}

        {candidates.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] text-text-secondary uppercase border-b border-border bg-bg-surface sticky top-0">
                <th className="py-2 px-3 font-medium">#</th>
                <th className="py-2 px-3 font-medium">Symbol</th>
                <th className="py-2 px-3 font-medium">Setup</th>
                <th className="py-2 px-3 font-medium">Entry</th>
                <th className="py-2 px-3 font-medium">Stop</th>
                <th className="py-2 px-3 font-medium">R:R</th>
                <th className="py-2 px-3 font-medium">Risk $</th>
                <th className="py-2 px-3 font-medium">Shares</th>
                <th className="py-2 px-3 font-medium">Sector</th>
                <th className="py-2 px-3 font-medium">Price</th>
                <th className="py-2 px-3 font-medium">Close</th>
                <th className="py-2 px-3 font-medium">Catalyst</th>
                <th className="py-2 px-3 font-medium">Gain</th>
                <th className="py-2 px-3 font-medium">Held</th>
                <th className="py-2 px-3 font-medium">AI</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <CandidateRow
                  key={c.symbol}
                  candidate={c}
                  isHeld={c.held !== undefined && c.held > 0}
                  onAnalyze={() => setActiveSymbol(c.symbol)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <AISidePanel />
    </div>
  );
}
