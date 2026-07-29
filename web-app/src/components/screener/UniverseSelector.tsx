import { useScreenerStore } from '@/store/useScreenerStore';
import { useI18n } from '@/i18n';

const universes: { value: string; i18nKey: string }[] = [
  { value: 'us_sp500', i18nKey: 'screener.universe.us_sp500' },
  { value: 'us_nasdaq100', i18nKey: 'screener.universe.us_nasdaq100' },
  { value: 'us_dow30', i18nKey: 'screener.universe.us_dow30' },
  { value: 'eu_midcap', i18nKey: 'screener.universe.eu_midcap' },
  { value: 'nl_amsterdam', i18nKey: 'screener.universe.nl_amsterdam' },
  { value: 'all', i18nKey: 'screener.universe.all' },
];

const simplifiedUniverses: { value: string; i18nKey: string }[] = [
  { value: 'all', i18nKey: 'screener.universe.all' },
  { value: 'favorites', i18nKey: 'screener.universe.favorites' },
];

interface Props {
  simplified?: boolean;
}

export default function UniverseSelector({ simplified }: Props) {
  const { t } = useI18n();
  const { universe, setUniverse } = useScreenerStore();
  const options = simplified ? simplifiedUniverses : universes;

  return (
    <select
      value={universe}
      onChange={(e) => setUniverse(e.target.value)}
      className="bg-bg-surface border border-border rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
    >
      {options.map((u) => (
        <option key={u.value} value={u.value}>{t(u.i18nKey)}</option>
      ))}
    </select>
  );
}
