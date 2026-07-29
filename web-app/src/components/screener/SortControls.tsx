import clsx from 'clsx';
import { useScreenerStore } from '../../store/useScreenerStore';
import { useI18n } from '../../i18n';

const options: { value: 'score' | 'rr' | 'price'; i18nKey: string }[] = [
  { value: 'score', i18nKey: 'screener.sort.score' },
  { value: 'rr', i18nKey: 'screener.sort.rr' },
  { value: 'price', i18nKey: 'screener.sort.price' },
];

const simplifiedOptions: { value: 'rr' | 'price'; i18nKey: string }[] = [
  { value: 'rr', i18nKey: 'screener.sort.rr' },
  { value: 'price', i18nKey: 'screener.sort.price' },
];

interface Props {
  simplified?: boolean;
}

export default function SortControls({ simplified }: Props) {
  const { t } = useI18n();
  const { sortBy, setSortBy } = useScreenerStore();
  const items = simplified ? simplifiedOptions : options;

  return (
    <div className="flex gap-1">
      {items.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setSortBy(opt.value)}
          className={clsx(
            'px-3 py-1.5 text-xs rounded border transition-colors',
            sortBy === opt.value
              ? 'border-accent text-accent bg-accent/10'
              : 'border-border text-text-secondary hover:text-text-primary',
          )}
        >
          {t(opt.i18nKey)}
        </button>
      ))}
    </div>
  );
}
