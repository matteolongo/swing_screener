import CollapsibleSection from '@/components/common/CollapsibleSection';
import { t } from '@/i18n/t';
import { NumberInput } from '@/components/domain/strategy/StrategyFieldControls';
import type { AdvancedSectionProps } from './types';

export default function RankingWeightsSection({ draft, setDraft, help }: AdvancedSectionProps) {
  return (
    <CollapsibleSection title={t('strategyPage.advanced.sections.rankingWeights')}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <NumberInput
          label={t('strategyPage.advanced.fields.weight6m')}
          value={draft.ranking.wMom6m}
          onChange={(value) =>
            setDraft({
              ...draft,
              ranking: { ...draft.ranking, wMom6m: value },
            })
          }
          step={0.05}
          min={0}
          help={help.weightMom6m}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.weight12m')}
          value={draft.ranking.wMom12m}
          onChange={(value) =>
            setDraft({
              ...draft,
              ranking: { ...draft.ranking, wMom12m: value },
            })
          }
          step={0.05}
          min={0}
          help={help.weightMom12m}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.weightRs')}
          value={draft.ranking.wRs6m}
          onChange={(value) =>
            setDraft({
              ...draft,
              ranking: { ...draft.ranking, wRs6m: value },
            })
          }
          step={0.05}
          min={0}
          help={help.weightRs}
        />
      </div>
    </CollapsibleSection>
  );
}
