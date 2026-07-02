import CollapsibleSection from '@/components/common/CollapsibleSection';
import { t } from '@/i18n/t';
import { CheckboxInput, NumberInput } from '@/components/domain/strategy/StrategyFieldControls';
import type { AdvancedSectionProps } from './types';

export default function VolatilitySection({ draft, setDraft }: AdvancedSectionProps) {
  return (
    <CollapsibleSection title={t('strategyPage.advanced.sections.volatility')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NumberInput
          label={t('strategyPage.advanced.fields.atrWindow')}
          value={draft.universe.vol.atrWindow}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                vol: { ...draft.universe.vol, atrWindow: value },
              },
            })
          }
          step={1}
          min={1}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.maxAtrPct')}
          value={draft.universe.filt.maxAtrPct}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                filt: { ...draft.universe.filt, maxAtrPct: value },
              },
            })
          }
          step={0.5}
          min={0}
          suffix="%"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        <CheckboxInput
          label={t('strategyPage.advanced.fields.requireTrendOk')}
          checked={draft.universe.filt.requireTrendOk}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                filt: { ...draft.universe.filt, requireTrendOk: value },
              },
            })
          }
        />
        <CheckboxInput
          label={t('strategyPage.advanced.fields.requireRsPositive')}
          checked={draft.universe.filt.requireRsPositive}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                filt: { ...draft.universe.filt, requireRsPositive: value },
              },
            })
          }
        />
      </div>
    </CollapsibleSection>
  );
}
