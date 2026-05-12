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
    onChange(value, parseFloat(e.target.value) || null);
  };

  const paramLabel =
    value === 'atr'
      ? t('positions.trailMethod.atrMultiplierLabel')
      : t('positions.trailMethod.fixedPctLabel');

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{t('positions.trailMethod.label')}</label>
      <select
        value={value}
        onChange={handleMethodChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
      >
        <option value="sma20">{t('positions.trailMethod.sma20')}</option>
        <option value="atr">{t('positions.trailMethod.atr')}</option>
        <option value="fixed_pct">{t('positions.trailMethod.fixedPct')}</option>
        <option value="manual">{t('positions.trailMethod.manual')}</option>
      </select>
      {showParam && (
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            {paramLabel}
          </label>
          <input
            type="number"
            step={value === 'atr' ? '0.1' : '0.5'}
            min="0.1"
            value={param ?? (value === 'atr' ? ATR_DEFAULT : FIXED_PCT_DEFAULT)}
            onChange={handleParamChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm"
          />
        </div>
      )}
      {value === 'manual' && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('positions.trailMethod.manualNote')}
        </p>
      )}
    </div>
  );
}
