import CollapsibleSection from '@/components/common/CollapsibleSection';
import { t } from '@/i18n/t';
import { CheckboxInput, NumberInput } from '@/components/domain/strategy/StrategyFieldControls';
import type { AdvancedSectionProps } from './types';

interface RiskDetailsSectionProps extends AdvancedSectionProps {
  lowRrWarning: boolean;
  highFeeWarning: boolean;
}

export default function RiskDetailsSection({
  draft,
  setDraft,
  help,
  lowRrWarning,
  highFeeWarning,
}: RiskDetailsSectionProps) {
  return (
    <CollapsibleSection title={t('strategyPage.advanced.sections.riskDetails')}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumberInput
          label={t('strategyPage.advanced.fields.minShares')}
          value={draft.risk.minShares}
          onChange={(value) =>
            setDraft({
              ...draft,
              risk: { ...draft.risk, minShares: value },
            })
          }
          step={1}
          min={1}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.minimumRr')}
          value={draft.risk.minRr}
          onChange={(value) =>
            setDraft({
              ...draft,
              risk: { ...draft.risk, minRr: value },
            })
          }
          step={0.1}
          min={0.5}
          help={help.minRr}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.takeProfitR')}
          value={draft.risk.rrTarget}
          onChange={(value) =>
            setDraft({
              ...draft,
              risk: { ...draft.risk, rrTarget: value },
            })
          }
          step={0.1}
          min={0.1}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.maxFeeRisk')}
          value={draft.risk.maxFeeRiskPct * 100}
          onChange={(value) =>
            setDraft({
              ...draft,
              risk: { ...draft.risk, maxFeeRiskPct: value / 100 },
            })
          }
          step={1}
          min={0}
          max={100}
          suffix="%"
          help={help.maxFeeRiskPct}
        />
        <NumberInput
          label={t('strategyPage.advanced.fields.commission')}
          value={draft.risk.commissionPct * 100}
          onChange={(value) =>
            setDraft({
              ...draft,
              risk: { ...draft.risk, commissionPct: value / 100 },
            })
          }
          step={0.05}
          min={0}
          suffix="%"
        />
      </div>
      {(lowRrWarning || highFeeWarning) && (
        <div className="mt-3 rounded border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <div className="font-semibold">{t('strategyPage.advanced.guardrails.title')}</div>
          {lowRrWarning && (
            <div>{t('strategyPage.advanced.guardrails.lowRr')}</div>
          )}
          {highFeeWarning && (
            <div>{t('strategyPage.advanced.guardrails.highFee')}</div>
          )}
        </div>
      )}
      <div className="mt-6">
        <div className="text-sm font-semibold mb-3">
          {t('strategyPage.advanced.sections.regimeRiskScaling')}
        </div>
        <div className="space-y-4">
          <CheckboxInput
            label={t('strategyPage.advanced.fields.enableRegimeScaling')}
            checked={draft.risk.regimeEnabled}
            onChange={(value) =>
              setDraft({
                ...draft,
                risk: { ...draft.risk, regimeEnabled: value },
              })
            }
            help={help.regimeEnabled}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NumberInput
              label={t('strategyPage.advanced.fields.trendSma')}
              value={draft.risk.regimeTrendSma}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  risk: { ...draft.risk, regimeTrendSma: value },
                })
              }
              step={1}
              min={50}
              help={help.regimeTrendSma}
            />
            <NumberInput
              label={t('strategyPage.advanced.fields.trendMultiplier')}
              value={draft.risk.regimeTrendMultiplier}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  risk: { ...draft.risk, regimeTrendMultiplier: value },
                })
              }
              step={0.05}
              min={0}
              max={1}
              help={help.regimeTrendMultiplier}
            />
            <NumberInput
              label={t('strategyPage.advanced.fields.volatilityAtrWindow')}
              value={draft.risk.regimeVolAtrWindow}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  risk: { ...draft.risk, regimeVolAtrWindow: value },
                })
              }
              step={1}
              min={2}
              help={help.regimeVolAtrWindow}
            />
            <NumberInput
              label={t('strategyPage.advanced.fields.volatilityAtrPctThreshold')}
              value={draft.risk.regimeVolAtrPctThreshold}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  risk: { ...draft.risk, regimeVolAtrPctThreshold: value },
                })
              }
              step={0.1}
              min={0}
              help={help.regimeVolAtrPctThreshold}
            />
            <NumberInput
              label={t('strategyPage.advanced.fields.volatilityMultiplier')}
              value={draft.risk.regimeVolMultiplier}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  risk: { ...draft.risk, regimeVolMultiplier: value },
                })
              }
              step={0.05}
              min={0}
              max={1}
              help={help.regimeVolMultiplier}
            />
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
