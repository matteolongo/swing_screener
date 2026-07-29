import { useScreener } from '../../hooks/useScreener';
import { useScreenerStore } from '../../store/useScreenerStore';

export default function PresetFilter() {
  const { preset, setPreset } = useScreenerStore();
  const { presets } = useScreener();

  return (
    <select
      value={preset ?? ''}
      onChange={(e) => setPreset(e.target.value || null)}
      className="bg-bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
    >
      <option value="">None</option>
      {presets.map((p) => (
        <option key={p.id} value={p.id}>{p.label}</option>
      ))}
    </select>
  );
}
