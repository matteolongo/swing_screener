import { useState, useMemo } from 'react';

interface Props {
  entry: number;
  currentStop: number;
  currentTarget: number;
  shares: number;
  direction?: 'long' | 'short';
  onClose: () => void;
}

export default function StopPreview({ entry, currentStop, currentTarget, shares, direction = 'long', onClose }: Props) {
  const min = entry * 0.95;
  const max = entry * 1.05;
  const [stop, setStop] = useState(currentStop);

  const clamped = Math.max(min, Math.min(max, stop));

  const risk$ = Math.abs(entry - clamped) * shares;

  const rr = useMemo(() => {
    const denom = entry - clamped;
    if (Math.abs(denom) < 0.001) return 0;
    const raw = direction === 'short'
      ? (clamped - currentTarget) / denom
      : (currentTarget - clamped) / denom;
    return Math.abs(raw);
  }, [entry, clamped, currentTarget, direction]);

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary italic">Preview \u2014 not saved.</span>
        <button onClick={onClose} className="text-xs text-text-secondary hover:text-text-primary">Close</button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-text-secondary">Stop Price</label>
        <input
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={clamped}
          onChange={(e) => setStop(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((clamped - min) / (max - min)) * 100}%, var(--border) ${((clamped - min) / (max - min)) * 100}%, var(--border) 100%)`,
          }}
        />
        <div className="flex justify-between text-[10px] text-text-secondary">
          <span>{min.toFixed(2)}</span>
          <span className="font-mono text-text-primary">{clamped.toFixed(2)}</span>
          <span>{max.toFixed(2)}</span>
        </div>
      </div>

      <div className="border-t border-border pt-2">
        <table className="w-full text-xs">
          <tbody>
            <tr className="border-b border-border">
              <td className="py-1 text-text-secondary">Stop</td>
              <td className="py-1 text-right font-mono text-text-primary">${clamped.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="py-1 text-text-secondary">R:R</td>
              <td className="py-1 text-right font-mono text-text-primary">{rr.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="py-1 text-text-secondary">Risk $</td>
              <td className="py-1 text-right font-mono text-text-primary">${risk$.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
