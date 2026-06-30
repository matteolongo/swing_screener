import { t } from '@/i18n/t';
import Button from '@/components/common/Button';
import Select from '@/components/common/Select';
import { cn } from '@/utils/cn';
import { usePresets } from '@/features/pool/hooks';
import { SECTORS, INDEX_OPTIONS } from '@/features/pool/sectors';
import type { TaxonomyFilterValues } from '@/features/pool/types';

interface QuickFilterBarProps {
  value: TaxonomyFilterValues;
  onChange: (next: TaxonomyFilterValues) => void;
  presetId: string | null;
  onPresetChange: (presetId: string | null) => void;
  sectors?: readonly string[];
  indexOptions?: { id: string; label: string }[];
  disabled?: boolean;
}

const REGION_OPTIONS: { value: string; label: string }[] = [
  { value: 'us', label: t('screener.taxonomy.region.us') },
  { value: 'europe', label: t('screener.taxonomy.region.europe') },
  { value: 'asia_pacific', label: t('screener.taxonomy.region.asiaPacific') },
];

const CAP_OPTIONS: { value: string; label: string }[] = [
  { value: 'large', label: t('screener.taxonomy.capTier.large') },
  { value: 'mid', label: t('screener.taxonomy.capTier.mid') },
  { value: 'small', label: t('screener.taxonomy.capTier.small') },
  { value: 'micro', label: t('screener.taxonomy.capTier.micro') },
];

const ETF_BUCKET = ['etf_equity', 'etf_sector', 'etf_leveraged', 'etf_bond', 'etf_commodity'];
const EQUITY_BUCKET = ['equity'];

function sameSet(a: string[] | undefined, b: string[]): boolean {
  if (!a || a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}

function pruned(values: TaxonomyFilterValues): TaxonomyFilterValues {
  const out: TaxonomyFilterValues = {};
  (Object.keys(values) as (keyof TaxonomyFilterValues)[]).forEach((k) => {
    const v = values[k];
    if (v && v.length) out[k] = v;
  });
  return out;
}

export default function QuickFilterBar(props: QuickFilterBarProps) {
  const { value, onChange, presetId, onPresetChange, disabled } = props;
  const sectors = props.sectors ?? SECTORS;
  const indexOptions = props.indexOptions ?? INDEX_OPTIONS;
  const { data: presets = [] } = usePresets();

  function patch(next: Partial<TaxonomyFilterValues>) {
    onPresetChange(null);
    onChange(pruned({ ...value, ...next }));
  }

  function toggleScalar(field: keyof TaxonomyFilterValues, item: string) {
    const current = (value[field] as string[] | undefined) ?? [];
    const next = current.includes(item)
      ? current.filter((x) => x !== item)
      : [...current, item];
    patch({ [field]: next });
  }

  function handlePreset(id: string) {
    if (!id) {
      onPresetChange(null);
      onChange({});
      return;
    }
    const preset = presets.find((p) => p.id === id);
    onPresetChange(id);
    onChange(preset ? pruned(preset.filter) : {});
  }

  const typeEquityActive = sameSet(value.instrumentTypeDetail, EQUITY_BUCKET);
  const typeEtfActive = sameSet(value.instrumentTypeDetail, ETF_BUCKET);

  function toggleType(bucket: string[], active: boolean) {
    patch({ instrumentTypeDetail: active ? [] : bucket });
  }

  const chip = (active: boolean) =>
    cn('rounded-full px-3 text-sm', active ? '' : 'text-muted');

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
      <label className="flex items-center gap-2 text-sm text-muted">
        {t('screener.taxonomy.preset')}
        <Select
          value={presetId ?? ''}
          disabled={disabled}
          onChange={(e) => handlePreset(e.target.value)}
          aria-label={t('screener.taxonomy.preset')}
        >
          <option value="">{t('screener.taxonomy.presetPlaceholder')}</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
        {presetId === null ? (
          <span className="text-xs text-muted">{t('screener.taxonomy.presetCustom')}</span>
        ) : null}
      </label>

      <ChipGroup label={t('screener.taxonomy.region.label')}>
        {REGION_OPTIONS.map((o) => {
          const active = (value.region ?? []).includes(o.value);
          return (
            <Button
              key={o.value}
              type="button"
              variant={active ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={active}
              disabled={disabled}
              className={chip(active)}
              onClick={() => toggleScalar('region', o.value)}
            >
              {o.label}
            </Button>
          );
        })}
      </ChipGroup>

      <ChipGroup label={t('screener.taxonomy.capTier.label')}>
        {CAP_OPTIONS.map((o) => {
          const active = (value.marketCapTier ?? []).includes(o.value);
          return (
            <Button
              key={o.value}
              type="button"
              variant={active ? 'primary' : 'secondary'}
              size="sm"
              aria-pressed={active}
              disabled={disabled}
              className={chip(active)}
              onClick={() => toggleScalar('marketCapTier', o.value)}
            >
              {o.label}
            </Button>
          );
        })}
      </ChipGroup>

      <ChipGroup label={t('screener.taxonomy.type.label')}>
        <Button
          type="button"
          variant={typeEquityActive ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={typeEquityActive}
          disabled={disabled}
          className={chip(typeEquityActive)}
          onClick={() => toggleType(EQUITY_BUCKET, typeEquityActive)}
        >
          {t('screener.taxonomy.type.equity')}
        </Button>
        <Button
          type="button"
          variant={typeEtfActive ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={typeEtfActive}
          disabled={disabled}
          className={chip(typeEtfActive)}
          onClick={() => toggleType(ETF_BUCKET, typeEtfActive)}
        >
          {t('screener.taxonomy.type.etf')}
        </Button>
      </ChipGroup>

      <MultiSelectDropdown
        label={t('screener.taxonomy.sector.label')}
        placeholder={t('screener.taxonomy.sector.placeholder')}
        options={sectors.map((s) => ({ id: s, label: s }))}
        selected={value.sector ?? []}
        disabled={disabled}
        onToggle={(id) => toggleScalar('sector', id)}
      />

      <MultiSelectDropdown
        label={t('screener.taxonomy.index.label')}
        placeholder={t('screener.taxonomy.index.placeholder')}
        options={indexOptions}
        selected={value.indexMemberships ?? []}
        disabled={disabled}
        onToggle={(id) => toggleScalar('indexMemberships', id)}
      />
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

interface MultiSelectDropdownProps {
  label: string;
  placeholder: string;
  options: { id: string; label: string }[];
  selected: string[];
  disabled?: boolean;
  onToggle: (id: string) => void;
}

function MultiSelectDropdown(props: MultiSelectDropdownProps) {
  const { label, placeholder, options, selected, disabled, onToggle } = props;
  const summary = selected.length ? `${label} (${selected.length})` : placeholder;
  return (
    <details className="relative">
      <summary className="cursor-pointer select-none rounded-md border border-border px-3 py-2 text-sm text-foreground">
        {summary}
      </summary>
      <div className="absolute z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-lg">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 px-1 py-1 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              disabled={disabled}
              onChange={() => onToggle(o.id)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}
