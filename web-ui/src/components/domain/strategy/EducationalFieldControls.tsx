/**
 * Enhanced field controls with educational documentation support
 * Implements Layer 1 (microcopy) and Layer 2 (expandable help)
 */
import type { ReactNode } from 'react';
import HelpTooltip from '@/components/common/HelpTooltip';
import Input from '@/components/common/Input';
import ExpandableHelp from './ExpandableHelp';
import ParameterWarning from './ParameterWarning';
import { getParameterDoc } from '@/content/strategy_docs/loader';
import type { ParameterDocumentation } from '@/content/strategy_docs/types';

export type HelpInfo = {
  short: string;
  title: string;
  content: ReactNode;
};

type EducationalNumberInputProps = {
  label: string;
  microcopy?: string; // Layer 1: one-sentence clarity
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  help?: HelpInfo;
  parameterKey?: string; // Key to load docs from strategy docs
  strategyModule?: string;
  warning?: { level: 'warning' | 'danger' | 'info'; message: ReactNode };
  recommendedBadge?: boolean;
};

export function EducationalNumberInput({
  label,
  microcopy,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  help,
  parameterKey,
  strategyModule = 'momentum',
  warning,
  recommendedBadge,
}: EducationalNumberInputProps) {
  const doc: ParameterDocumentation | null = parameterKey
    ? getParameterDoc(strategyModule, parameterKey)
    : null;

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex items-center gap-2">
            {label}
            {recommendedBadge && (
              <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">
                ✔ Recommended
              </span>
            )}
          </span>
          {help && <HelpTooltip short={help.short} title={help.title} content={help.content} />}
          {suffix && <span className="text-xs text-muted">{suffix}</span>}
        </div>
        {microcopy && (
          <div className="mb-2 text-xs text-muted leading-relaxed">
            {microcopy}
          </div>
        )}
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          min={min}
          max={max}
        />
      </label>

      {warning && <ParameterWarning level={warning.level} message={warning.message} />}

      {doc && <ExpandableHelp doc={doc} />}
    </div>
  );
}

type EducationalCheckboxInputProps = {
  label: string;
  microcopy?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: HelpInfo;
  parameterKey?: string;
  strategyModule?: string;
  warning?: { level: 'warning' | 'danger' | 'info'; message: ReactNode };
};

export function EducationalCheckboxInput({
  label,
  microcopy,
  checked,
  onChange,
  help,
  parameterKey,
  strategyModule = 'momentum',
  warning,
}: EducationalCheckboxInputProps) {
  const doc: ParameterDocumentation | null = parameterKey
    ? getParameterDoc(strategyModule, parameterKey)
    : null;

  return (
    <div className="space-y-1">
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

      {microcopy && (
        <div className="ml-6 text-xs text-muted leading-relaxed">
          {microcopy}
        </div>
      )}

      {warning && <ParameterWarning level={warning.level} message={warning.message} />}

      {doc && <ExpandableHelp doc={doc} />}
    </div>
  );
}
