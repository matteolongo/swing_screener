import type { ReactNode } from 'react';
import HelpTooltip from '@/components/common/HelpTooltip';

export const strategyFieldClass =
  'w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800';

export type HelpInfo = {
  short: string;
  title: string;
  content: ReactNode;
};

export const buildHelp = (
  title: string,
  short: string,
  what: string,
  why: string,
  how: string,
): HelpInfo => ({
  title,
  short,
  content: (
    <div className="space-y-2">
      <p>
        <strong>What it is:</strong> {what}
      </p>
      <p>
        <strong>Why it matters:</strong> {why}
      </p>
      <p>
        <strong>How to interpret:</strong> {how}
      </p>
    </div>
  ),
});

type NumberInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  help?: HelpInfo;
};

export function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  help,
}: NumberInputProps) {
  return (
    <label className="text-sm font-medium">
      <div className="mb-2 flex items-center gap-2">
        <span>{label}</span>
        {help && <HelpTooltip short={help.short} title={help.title} content={help.content} />}
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={strategyFieldClass}
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
  help?: HelpInfo;
};

export function TextInput({ label, value, onChange, placeholder, help }: TextInputProps) {
  return (
    <label className="text-sm font-medium">
      <div className="mb-2 flex items-center gap-2">
        <span>{label}</span>
        {help && <HelpTooltip short={help.short} title={help.title} content={help.content} />}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={strategyFieldClass}
      />
    </label>
  );
}

type SelectInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  help?: HelpInfo;
};

export function SelectInput({ label, value, onChange, options, help }: SelectInputProps) {
  return (
    <label className="text-sm font-medium">
      <div className="mb-2 flex items-center gap-2">
        <span>{label}</span>
        {help && <HelpTooltip short={help.short} title={help.title} content={help.content} />}
      </div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={strategyFieldClass}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type CheckboxInputProps = {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: HelpInfo;
};

export function CheckboxInput({ label, checked, onChange, help }: CheckboxInputProps) {
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
      {help && <HelpTooltip short={help.short} title={help.title} content={help.content} />}
    </div>
  );
}
