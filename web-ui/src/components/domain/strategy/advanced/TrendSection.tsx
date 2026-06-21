import CollapsibleSection from '@/components/common/CollapsibleSection';
import { t } from '@/i18n/t';
import { NumberInput } from '@/components/domain/strategy/StrategyFieldControls';
import type { AdvancedSectionProps } from './types';

export default function TrendSection({ draft, setDraft, help }: AdvancedSectionProps) {
  return (
    <CollapsibleSection defaultOpen title={t('strategyPage.advanced.sections.trend')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NumberInput
          label={t('strategyPage.advanced.fields.smaFast')}
          value={draft.universe.trend.smaFast}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                trend: { ...draft.universe.trend, smaFast: value },
              },
            })
          }
          step={1}
          min={1}
          help={help.smaFast}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.smaMid')}
          value={draft.universe.trend.smaMid}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                trend: { ...draft.universe.trend, smaMid: value },
              },
            })
          }
          step={1}
          min={1}
          help={help.smaMid}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.smaLong')}
          value={draft.universe.trend.smaLong}
          onChange={(value) =>
            setDraft({
              ...draft,
              universe: {
                ...draft.universe,
                trend: { ...draft.universe.trend, smaLong: value },
              },
            })
          }
          step={1}
          min={1}
          help={help.smaLong}
        />
      </div>
    </CollapsibleSection>
  );
}
