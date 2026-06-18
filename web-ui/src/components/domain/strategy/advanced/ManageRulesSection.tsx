import CollapsibleSection from '@/components/common/CollapsibleSection';
import { t } from '@/i18n/t';
import { NumberInput, TextInput } from '@/components/domain/strategy/StrategyFieldControls';
import type { AdvancedSectionProps } from './types';

export default function ManageRulesSection({ draft, setDraft, help }: AdvancedSectionProps) {
  return (
    <CollapsibleSection title={t('strategyPage.advanced.sections.manageRules')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NumberInput
          label={t('strategyPage.advanced.fields.breakevenAtR')}
          value={draft.manage.breakevenAtR}
          onChange={(value) =>
            setDraft({
              ...draft,
              manage: { ...draft.manage, breakevenAtR: value },
            })
          }
          step={0.1}
          min={0}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.trailAfterR')}
          value={draft.manage.trailAfterR}
          onChange={(value) =>
            setDraft({
              ...draft,
              manage: { ...draft.manage, trailAfterR: value },
            })
          }
          step={0.1}
          min={0}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.trailSma')}
          value={draft.manage.trailSma}
          onChange={(value) =>
            setDraft({
              ...draft,
              manage: { ...draft.manage, trailSma: value },
            })
          }
          step={1}
          min={1}
          help={help.trailSma}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.smaBuffer')}
          value={draft.manage.smaBufferPct * 100}
          onChange={(value) =>
            setDraft({
              ...draft,
              manage: { ...draft.manage, smaBufferPct: value / 100 },
            })
          }
          step={0.1}
          min={0}
          suffix="%"
          help={help.smaBuffer}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.maxHoldingDays')}
          value={draft.manage.maxHoldingDays}
          onChange={(value) =>
            setDraft({
              ...draft,
              manage: { ...draft.manage, maxHoldingDays: value },
            })
          }
          step={1}
          min={1}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.timeStopDays')}
          value={draft.manage.timeStopDays}
          onChange={(value) =>
            setDraft({
              ...draft,
              manage: { ...draft.manage, timeStopDays: value },
            })
          }
          step={1}
          min={1}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.timeStopMinR')}
          value={draft.manage.timeStopMinR}
          onChange={(value) =>
            setDraft({
              ...draft,
              manage: { ...draft.manage, timeStopMinR: value },
            })
          }
          step={0.1}
          min={0}
        />
        <TextInput
          label={t('strategyPage.advanced.fields.benchmark')}
          value={draft.manage.benchmark}
          onChange={(value) =>
            setDraft({
              ...draft,
              manage: { ...draft.manage, benchmark: value.toUpperCase() },
            })
          }
        />
      </div>
    </CollapsibleSection>
  );
}
