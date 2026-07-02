import CollapsibleSection from '@/components/common/CollapsibleSection';
import { t } from '@/i18n/t';
import { NumberInput, TextInput } from '@/components/domain/strategy/StrategyFieldControls';
import type { AdvancedSectionProps } from './types';

export default function MomentumSection({ draft, setDraft }: AdvancedSectionProps) {
  return (
    <CollapsibleSection title={t('strategyPage.advanced.sections.momentum')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NumberInput
          label={t('strategyPage.advanced.fields.lookback6m')}
          value={draft.universe.mom.lookback6m}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                mom: { ...draft.universe.mom, lookback6m: value },
              },
            })
          }
          step={1}
          min={1}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.lookback12m')}
          value={draft.universe.mom.lookback12m}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                mom: { ...draft.universe.mom, lookback12m: value },
              },
            })
          }
          step={1}
          min={1}
        />
        <TextInput
          label={t('strategyPage.advanced.fields.benchmark')}
          value={draft.universe.mom.benchmark}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                mom: { ...draft.universe.mom, benchmark: value.toUpperCase() },
              },
            })
          }
        />
      </div>
    </CollapsibleSection>
  );
}
