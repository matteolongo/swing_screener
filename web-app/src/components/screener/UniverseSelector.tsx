import { useScreenerStore } from '../../store/useScreenerStore';

const universes = [
  { value: 'us_sp500', label: 'S&P 500' },
  { value: 'us_nasdaq100', label: 'Nasdaq 100' },
  { value: 'us_dow30', label: 'Dow 30' },
  { value: 'eu_midcap', label: 'EU Mid-Cap' },
  { value: 'nl_amsterdam', label: 'Amsterdam' },
  { value: 'all', label: 'All' },
];

export default function UniverseSelector() {
  const { universe, setUniverse } = useScreenerStore();

  return (
    <select
      value={universe}
      onChange={(e) => setUniverse(e.target.value)}
      className="bg-bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
    >
      {universes.map((u) => (
        <option key={u.value} value={u.value}>{u.label}</option>
      ))}
    </select>
  );
}
