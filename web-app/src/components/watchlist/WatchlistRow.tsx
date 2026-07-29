import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { Circle, MoreVertical } from 'lucide-react';
import type { WatchlistItem } from '../../types/api';

interface Props {
  item: WatchlistItem;
  onAnalyze?: (symbol: string) => void;
  onRemove?: (symbol: string) => void;
  onRunScreener?: (symbol: string) => void;
}

function changeColor(pct: number): string {
  return pct >= 0 ? 'text-success' : 'text-danger';
}

function formatChange(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

export default function WatchlistRow({ item, onAnalyze, onRemove, onRunScreener }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    function close() { setContextMenu(null); }
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function closeMenus() {
    setMenuOpen(false);
    setContextMenu(null);
  }

  function handleAnalyze() {
    onAnalyze?.(item.symbol);
    closeMenus();
  }

  function handleRemove() {
    onRemove?.(item.symbol);
    closeMenus();
  }

  function handleRunScreener() {
    onRunScreener?.(item.symbol);
    closeMenus();
  }

  return (
    <tr
      className="border-b border-border hover:bg-[var(--bg-elevated)] transition-colors text-[13px]"
      onContextMenu={handleContextMenu}
    >
      <td className="py-2 px-3">
        <span className="font-medium text-text-primary">{item.symbol}</span>
        <span className="ml-1.5 text-[11px] text-text-secondary">{item.exchange_mic}</span>
      </td>

      <td className="py-2 px-3 price-font">{item.price.toFixed(2)}</td>

      <td className={clsx('py-2 px-3 price-font font-medium', changeColor(item.change_pct))}>
        {formatChange(item.change_pct)}
      </td>

      <td className="py-2 px-3">
        {item.setup && (
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-accent/20 text-accent">
            {item.setup}
          </span>
        )}
      </td>

      <td className="py-2 px-3 price-font">
        {item.rr !== undefined && (
          <span className={clsx('font-medium', item.rr >= 2.0 ? 'text-success' : item.rr >= 1.5 ? 'text-warning' : 'text-danger')}>
            {item.rr.toFixed(2)}
          </span>
        )}
      </td>

      <td className="py-2 px-3">
        <span className="inline-block px-1.5 py-0.5 rounded bg-bg-elevated text-text-secondary text-[11px]">
          {item.sector}
        </span>
      </td>

      <td className="py-2 px-3">
        {item.held !== undefined && item.held > 0 && (
          <Circle size={10} fill="#3b82f6" color="#3b82f6" />
        )}
      </td>

      <td className="py-2 px-3 relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <MoreVertical size={14} />
        </button>

        {menuOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1 z-30 w-40 rounded border border-border bg-bg-elevated shadow-xl"
          >
            <button onClick={handleRunScreener} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-surface transition-colors">
              Run Screener
            </button>
            <button onClick={handleAnalyze} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-surface transition-colors">
              Analyze
            </button>
            <div className="border-t border-border" />
            <button onClick={handleRemove} className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-bg-surface transition-colors">
              Remove
            </button>
          </div>
        )}
      </td>

      {contextMenu && (
        <div
          className="fixed z-50 w-40 rounded border border-border bg-bg-elevated shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={handleRunScreener} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-surface transition-colors">
            Run Screener
          </button>
          <button onClick={handleAnalyze} className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-bg-surface transition-colors">
            Analyze
          </button>
          <div className="border-t border-border" />
          <button onClick={handleRemove} className="w-full text-left px-3 py-2 text-xs text-danger hover:bg-bg-surface transition-colors">
            Remove
          </button>
        </div>
      )}
    </tr>
  );
}
