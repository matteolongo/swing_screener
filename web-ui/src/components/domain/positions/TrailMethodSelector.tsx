import type { TrailMethod } from '@/features/portfolio/types';
import { t } from '@/i18n/t';

interface TrailMethodSelectorProps {
  value: TrailMethod;
  param: number | null | undefined;
  onChange: (method: TrailMethod, param: number | null) => void;
}

const ATR_DEFAULT = 2.0;
const FIXED_PCT_DEFAULT = 5.0;

export default function TrailMethodSelector({
  value,
  param,
  onChange,
}: TrailMethodSelectorProps) {
  const showParam = value === 'atr' || value === 'fixed_pct';

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const method = e.target.value as TrailMethod;
    const defaultParam =
      method === 'atr' ? ATR_DEFAULT : method === 'fixed_pct' ? FIXED_PCT_DEFAULT : null;
    onChange(method, defaultParam);
  };

  const handleParamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    onChange(value, Number.isFinite(parsed) ? parsed : null);
  };

  const paramLabel =
    value === 'atr'
      ? t('positions.trailMethod.atrMultiplierLabel')
      : t('positions.trailMethod.fixedPctLabel');

  return (
    <div className="space-y-2">
      <label htmlFor="trail-method-select" className="block text-sm font-medium">{t('positions.trailMethod.label')}</label>
      <select
        id="trail-method-select"
        value={value}
        onChange={handleMethodChange}
        className="w-full px-3 py-2 border border-border rounded bg-surface text-sm"
      >
        <option value="sma20">{t('positions.trailMethod.sma20')}</option>
        <option value="atr">{t('positions.trailMethod.atr')}</option>
        <option value="fixed_pct">{t('positions.trailMethod.fixedPct')}</option>
        <option value="manual">{t('positions.trailMethod.manual')}</option>
      </select>
      {showParam && (
        <div>
          <label htmlFor="trail-param-input" className="block text-xs text-muted mb-1">
            {paramLabel}
          </label>
          <input
            id="trail-param-input"
            type="number"
            step={value === 'atr' ? '0.1' : '0.5'}
            min="0.1"
            value={param ?? (value === 'atr' ? ATR_DEFAULT : FIXED_PCT_DEFAULT)}
            onChange={handleParamChange}
            className="w-full px-3 py-2 border border-border rounded bg-surface text-sm"
          />
        </div>
      )}
      {value === 'manual' && (
        <p className="text-xs text-muted">
          {t('positions.trailMethod.manualNote')}
        </p>
      )}
    </div>
  );
}
