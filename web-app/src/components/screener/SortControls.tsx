import clsx from 'clsx';
import { useScreenerStore } from '../../store/useScreenerStore';

const options: { value: 'score' | 'rr' | 'price'; label: string }[] = [
  { value: 'score', label: 'Score' },
  { value: 'rr', label: 'R:R' },
  { value: 'price', label: 'Price' },
];

const simplifiedOptions: { value: 'rr' | 'price'; label: string }[] = [
  { value: 'rr', label: 'R:R' },
  { value: 'price', label: 'Price' },
];

interface Props {
  simplified?: boolean;
}

export default function SortControls({ simplified }: Props) {
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
          {opt.label}
        </button>
      ))}
    </div>
  );
}
