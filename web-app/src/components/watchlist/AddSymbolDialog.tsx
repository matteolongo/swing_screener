import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { getSymbolPool } from '@/services/api/screenerApi';
import type { PoolSymbol } from '@/types/api';
import { useI18n } from '@/i18n';

interface Props {
  onSelect: (ticker: string) => void;
  onClose: () => void;
}

export default function AddSymbolDialog({ onSelect, onClose }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PoolSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await getSymbolPool({ q: query.trim() });
        if (!cancelled) setResults(data.symbols);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md mx-4 rounded-lg border border-border bg-bg-surface shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-text-secondary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('addSymbolDialog.searchPlaceholder')}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-secondary focus:outline-none"
          />
          {loading && <Loader2 size={14} className="animate-spin text-text-secondary" />}
          <button
            onClick={onClose}
            className="p-0.5 text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {results.length === 0 && query.trim() && !loading && (
            <div className="px-4 py-6 text-center text-text-secondary text-xs">
              {t('addSymbolDialog.empty')}
            </div>
          )}

          {results.map((s) => (
            <button
              key={s.symbol}
              onClick={() => onSelect(s.symbol)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-elevated transition-colors"
            >
              <span className="text-sm font-medium text-text-primary">{s.symbol}</span>
              {s.exchange_mic && (
                <span className="text-[11px] text-text-secondary">{s.exchange_mic}</span>
              )}
              {s.sector && (
                <span className="ml-auto text-[11px] text-text-secondary">{s.sector}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
