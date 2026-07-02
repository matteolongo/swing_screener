import Input from '@/components/common/Input';
import Select from '@/components/common/Select';

type NumberInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
};

export function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
}: NumberInputProps) {
  return (
    <label className="text-sm font-medium">
      <div className="mb-2 flex items-center gap-2">
        <span>{label}</span>
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </div>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        step={step}
        min={min}
        max={max}
      />
    </label>
  );
}

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function TextInput({ label, value, onChange, placeholder }: TextInputProps) {
  return (
    <label className="text-sm font-medium">
      <div className="mb-2 flex items-center gap-2">
        <span>{label}</span>
      </div>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

type SelectInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
};

export function SelectInput({ label, value, onChange, options }: SelectInputProps) {
  return (
    <label className="text-sm font-medium">
      <div className="mb-2 flex items-center gap-2">
        <span>{label}</span>
      </div>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

type CheckboxInputProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
};

export function CheckboxInput({ label, checked, onChange }: CheckboxInputProps) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <span>{label}</span>
      </label>
    </div>
  );
}
