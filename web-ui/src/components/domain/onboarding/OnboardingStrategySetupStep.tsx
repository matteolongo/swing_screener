import { useEffect, useMemo, useState } from 'react';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { strategyFieldClass } from '@/components/domain/strategy/StrategyFieldControls';
import {
  applyPresetToStrategy,
  momentumPresets,
} from '@/components/domain/strategy/StrategyPresets';
import { useActiveStrategyQuery, useUpdateStrategyMutation } from '@/features/strategy/hooks';
import type { Strategy } from '@/features/strategy/types';
import { t } from '@/i18n/t';

type SetupMode = 'conservative' | 'balanced' | 'aggressive' | 'custom';

const MODE_LABELS: Record<SetupMode, string> = {
  conservative: t('onboardingPage.strategyStep.modes.conservative'),
  balanced: t('onboardingPage.strategyStep.modes.balanced'),
  aggressive: t('onboardingPage.strategyStep.modes.aggressive'),
  custom: t('onboardingPage.strategyStep.modes.custom'),
};

function cloneStrategy(strategy: Strategy): Strategy {
  return JSON.parse(JSON.stringify(strategy)) as Strategy;
}

interface OnboardingStrategySetupStepProps {
  onSaved?: () => void;
}

export default function OnboardingStrategySetupStep({ onSaved }: OnboardingStrategySetupStepProps) {
  const activeStrategyQuery = useActiveStrategyQuery();
  const [draft, setDraft] = useState<Strategy | null>(null);
  const [setupMode, setSetupMode] = useState<SetupMode>('balanced');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const updateMutation = useUpdateStrategyMutation((updated) => {
    setDraft(cloneStrategy(updated));
    setStatusMessage(t('onboardingPage.strategyStep.saved'));
    onSaved?.();
  });

  useEffect(() => {
    if (!activeStrategyQuery.data) return;
    setDraft(cloneStrategy(activeStrategyQuery.data));
  }, [activeStrategyQuery.data]);

  const selectedPreset = useMemo(
    () => momentumPresets.find((preset) => preset.id === setupMode) ?? null,
    [setupMode],
  );

  const applyMode = (mode: SetupMode) => {
    if (!draft) return;
    setStatusMessage(null);
    setSetupMode(mode);
    if (mode === 'custom') {
      return;
    }

    const preset = momentumPresets.find((candidate) => candidate.id === mode);
    if (!preset) return;
    setDraft(applyPresetToStrategy(draft, preset));
  };

  const updateAccountSize = (rawValue: string) => {
    if (!draft) return;
    const nextValue = Number.parseFloat(rawValue);
    setStatusMessage(null);
    setDraft({
      ...draft,
      risk: {
        ...draft.risk,
        accountSize: Number.isFinite(nextValue) ? nextValue : 0,
      },
    });
  };

  const updateRiskField = (key: 'riskPct' | 'maxPositionPct' | 'minRr', rawValue: string) => {
    if (!draft) return;
    const nextValue = Number.parseFloat(rawValue);
    setStatusMessage(null);
    setSetupMode('custom');
    setDraft({
      ...draft,
      risk: {
        ...draft.risk,
        [key]: Number.isFinite(nextValue) ? nextValue : 0,
      },
    });
  };

  const handleSave = () => {
    if (!draft) return;
    setStatusMessage(null);
    updateMutation.mutate(draft);
  };

  if (activeStrategyQuery.isLoading || !draft) {
    return (
      <Card variant="bordered">
        <CardContent>
          <p className="text-sm text-gray-600">{t('onboardingPage.strategyStep.loading')}</p>
        </CardContent>
      </Card>
    );
  }

  if (activeStrategyQuery.isError) {
    return (
      <Card variant="bordered">
        <CardContent>
          <p className="text-sm text-red-600">{t('onboardingPage.strategyStep.loadError')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="bordered">
      <CardHeader>
        <CardTitle>{t('onboardingPage.strategyStep.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{t('onboardingPage.strategyStep.description')}</p>

        <label className="block text-sm font-medium">
          <div className="mb-1">{t('onboardingPage.strategyStep.fields.accountSize')}</div>
          <input
            type="number"
            value={Number.isFinite(draft.risk.accountSize) ? draft.risk.accountSize : 0}
            onChange={(event) => updateAccountSize(event.target.value)}
            className={strategyFieldClass}
            min={0}
            step={100}
          />
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['conservative', 'balanced', 'aggressive', 'custom'] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              variant={setupMode === mode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => applyMode(mode)}
            >
              {MODE_LABELS[mode]}
            </Button>
          ))}
        </div>

        {selectedPreset ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">{selectedPreset.name}</p>
            <p className="text-xs text-blue-800">{selectedPreset.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white px-2 py-1">
                {t('onboardingPage.strategyStep.preview.riskPct', {
                  value: ((selectedPreset.values.risk?.riskPct ?? 0) * 100).toFixed(1),
                })}
              </span>
              <span className="rounded-full bg-white px-2 py-1">
                {t('onboardingPage.strategyStep.preview.maxPositionPct', {
                  value: ((selectedPreset.values.risk?.maxPositionPct ?? 0) * 100).toFixed(0),
                })}
              </span>
              <span className="rounded-full bg-white px-2 py-1">
                {t('onboardingPage.strategyStep.preview.minRr', {
                  value: selectedPreset.values.risk?.minRr ?? 0,
                })}
              </span>
            </div>
          </div>
        ) : null}

        {setupMode === 'custom' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              <div className="mb-1">{t('onboardingPage.strategyStep.fields.riskPct')}</div>
              <input
                type="number"
                value={Number.isFinite(draft.risk.riskPct) ? draft.risk.riskPct : 0}
                onChange={(event) => updateRiskField('riskPct', event.target.value)}
                className={strategyFieldClass}
                min={0}
                step={0.001}
              />
            </label>

            <label className="text-sm font-medium">
              <div className="mb-1">{t('onboardingPage.strategyStep.fields.maxPositionPct')}</div>
              <input
                type="number"
                value={Number.isFinite(draft.risk.maxPositionPct) ? draft.risk.maxPositionPct : 0}
                onChange={(event) => updateRiskField('maxPositionPct', event.target.value)}
                className={strategyFieldClass}
                min={0}
                step={0.01}
              />
            </label>

            <label className="text-sm font-medium">
              <div className="mb-1">{t('onboardingPage.strategyStep.fields.minRr')}</div>
              <input
                type="number"
                value={Number.isFinite(draft.risk.minRr) ? draft.risk.minRr : 0}
                onChange={(event) => updateRiskField('minRr', event.target.value)}
                className={strategyFieldClass}
                min={0}
                step={0.1}
              />
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending
              ? t('onboardingPage.strategyStep.saving')
              : t('onboardingPage.strategyStep.save')}
          </Button>
          {statusMessage ? <p className="text-sm text-green-700">{statusMessage}</p> : null}
          {updateMutation.isError ? (
            <p className="text-sm text-red-600">
              {(updateMutation.error as Error)?.message || t('onboardingPage.strategyStep.saveError')}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
