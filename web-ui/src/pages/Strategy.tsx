import { useEffect, useMemo, useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useStrategyEditor } from '@/features/strategy/useStrategyEditor';
import { useStrategyValidationQuery } from '@/features/strategy/hooks';
import { toStrategyUpdateRequest } from '@/features/strategy/types';
import StrategyAdvancedSettingsCard from '@/components/domain/strategy/StrategyAdvancedSettingsCard';
import StrategyPhilosophyCard from '@/components/domain/strategy/StrategyPhilosophyCard';
import StrategySafetyScore from '@/components/domain/strategy/StrategySafetyScore';
import { applyPresetToStrategy, momentumPresets } from '@/components/domain/strategy/StrategyPresets';
import { useI18n } from '@/i18n/I18nProvider';
import {
  buildHelp,
  NumberInput,
  SelectInput,
  strategyFieldClass,
  TextInput,
} from '@/components/domain/strategy/StrategyFieldControls';
import { getStrategyInfo } from '@/content/strategy_docs/loader';
import { Section } from '@/components/ui/Section';
import {
  parseUniverseFromStorage,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';

const MIN_SAFE_SCORE = 90;

export default function StrategyPage() {
  const { locale, t } = useI18n();
  const [advancedUnlocked, setAdvancedUnlocked] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [saveGuardrailError, setSaveGuardrailError] = useState<string | null>(null);
  const [selectedReviewUniverse, setSelectedReviewUniverse] = useState(
    () => parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY)) ?? 'usd_all'
  );
  const reviewUniverseOptions = [
    { value: 'usd_all', label: t('strategyPage.core.options.reviewUniverseUsdAll') },
    { value: 'usd_mega_stocks', label: t('strategyPage.core.options.reviewUniverseUsdMegaStocks') },
    { value: 'usd_core_etfs', label: t('strategyPage.core.options.reviewUniverseUsdCoreEtfs') },
    { value: 'usd_defense_all', label: t('strategyPage.core.options.reviewUniverseUsdDefenseAll') },
    { value: 'usd_healthcare_all', label: t('strategyPage.core.options.reviewUniverseUsdHealthcareAll') },
    { value: 'eur_europe_large', label: t('strategyPage.core.options.reviewUniverseEurEuropeLarge') },
    { value: 'eur_amsterdam_all', label: t('strategyPage.core.options.reviewUniverseEurAmsterdamAll') },
    { value: 'eur_amsterdam_aex', label: t('strategyPage.core.options.reviewUniverseEurAmsterdamAex') },
    { value: 'eur_amsterdam_amx', label: t('strategyPage.core.options.reviewUniverseEurAmsterdamAmx') },
  ];

  const help = useMemo(
    () => ({
      module: buildHelp(
        t('strategyPage.help.items.module.title'),
        t('strategyPage.help.items.module.short'),
        t('strategyPage.help.items.module.what'),
        t('strategyPage.help.items.module.why'),
        t('strategyPage.help.items.module.how')
      ),
      breakoutLookback: buildHelp(
        t('strategyPage.help.items.breakoutLookback.title'),
        t('strategyPage.help.items.breakoutLookback.short'),
        t('strategyPage.help.items.breakoutLookback.what'),
        t('strategyPage.help.items.breakoutLookback.why'),
        t('strategyPage.help.items.breakoutLookback.how'),
        t('strategyPage.help.items.breakoutLookback.execution')
      ),
      pullbackMa: buildHelp(
        t('strategyPage.help.items.pullbackMa.title'),
        t('strategyPage.help.items.pullbackMa.short'),
        t('strategyPage.help.items.pullbackMa.what'),
        t('strategyPage.help.items.pullbackMa.why'),
        t('strategyPage.help.items.pullbackMa.how'),
        t('strategyPage.help.items.pullbackMa.execution')
      ),
      minHistory: buildHelp(
        t('strategyPage.help.items.minHistory.title'),
        t('strategyPage.help.items.minHistory.short'),
        t('strategyPage.help.items.minHistory.what'),
        t('strategyPage.help.items.minHistory.why'),
        t('strategyPage.help.items.minHistory.how')
      ),
      smaFast: buildHelp(
        t('strategyPage.help.items.smaFast.title'),
        t('strategyPage.help.items.smaFast.short'),
        t('strategyPage.help.items.smaFast.what'),
        t('strategyPage.help.items.smaFast.why'),
        t('strategyPage.help.items.smaFast.how')
      ),
      smaMid: buildHelp(
        t('strategyPage.help.items.smaMid.title'),
        t('strategyPage.help.items.smaMid.short'),
        t('strategyPage.help.items.smaMid.what'),
        t('strategyPage.help.items.smaMid.why'),
        t('strategyPage.help.items.smaMid.how')
      ),
      smaLong: buildHelp(
        t('strategyPage.help.items.smaLong.title'),
        t('strategyPage.help.items.smaLong.short'),
        t('strategyPage.help.items.smaLong.what'),
        t('strategyPage.help.items.smaLong.why'),
        t('strategyPage.help.items.smaLong.how')
      ),
      atrWindow: buildHelp(
        t('strategyPage.help.items.atrWindow.title'),
        t('strategyPage.help.items.atrWindow.short'),
        t('strategyPage.help.items.atrWindow.what'),
        t('strategyPage.help.items.atrWindow.why'),
        t('strategyPage.help.items.atrWindow.how')
      ),
      atrMultiplier: buildHelp(
        t('strategyPage.help.items.atrMultiplier.title'),
        t('strategyPage.help.items.atrMultiplier.short'),
        t('strategyPage.help.items.atrMultiplier.what'),
        t('strategyPage.help.items.atrMultiplier.why'),
        t('strategyPage.help.items.atrMultiplier.how')
      ),
      minRr: buildHelp(
        t('strategyPage.help.items.minRr.title'),
        t('strategyPage.help.items.minRr.short'),
        t('strategyPage.help.items.minRr.what'),
        t('strategyPage.help.items.minRr.why'),
        t('strategyPage.help.items.minRr.how')
      ),
      maxFeeRiskPct: buildHelp(
        t('strategyPage.help.items.maxFeeRiskPct.title'),
        t('strategyPage.help.items.maxFeeRiskPct.short'),
        t('strategyPage.help.items.maxFeeRiskPct.what'),
        t('strategyPage.help.items.maxFeeRiskPct.why'),
        t('strategyPage.help.items.maxFeeRiskPct.how')
      ),
      maxAtrPct: buildHelp(
        t('strategyPage.help.items.maxAtrPct.title'),
        t('strategyPage.help.items.maxAtrPct.short'),
        t('strategyPage.help.items.maxAtrPct.what'),
        t('strategyPage.help.items.maxAtrPct.why'),
        t('strategyPage.help.items.maxAtrPct.how')
      ),
      requireTrendOk: buildHelp(
        t('strategyPage.help.items.requireTrendOk.title'),
        t('strategyPage.help.items.requireTrendOk.short'),
        t('strategyPage.help.items.requireTrendOk.what'),
        t('strategyPage.help.items.requireTrendOk.why'),
        t('strategyPage.help.items.requireTrendOk.how')
      ),
      requireRsPositive: buildHelp(
        t('strategyPage.help.items.requireRsPositive.title'),
        t('strategyPage.help.items.requireRsPositive.short'),
        t('strategyPage.help.items.requireRsPositive.what'),
        t('strategyPage.help.items.requireRsPositive.why'),
        t('strategyPage.help.items.requireRsPositive.how')
      ),
      currencies: buildHelp(
        t('strategyPage.help.items.currencies.title'),
        t('strategyPage.help.items.currencies.short'),
        t('strategyPage.help.items.currencies.what'),
        t('strategyPage.help.items.currencies.why'),
        t('strategyPage.help.items.currencies.how')
      ),
      momentum6m: buildHelp(
        t('strategyPage.help.items.momentum6m.title'),
        t('strategyPage.help.items.momentum6m.short'),
        t('strategyPage.help.items.momentum6m.what'),
        t('strategyPage.help.items.momentum6m.why'),
        t('strategyPage.help.items.momentum6m.how')
      ),
      momentum12m: buildHelp(
        t('strategyPage.help.items.momentum12m.title'),
        t('strategyPage.help.items.momentum12m.short'),
        t('strategyPage.help.items.momentum12m.what'),
        t('strategyPage.help.items.momentum12m.why'),
        t('strategyPage.help.items.momentum12m.how')
      ),
      benchmark: buildHelp(
        t('strategyPage.help.items.benchmark.title'),
        t('strategyPage.help.items.benchmark.short'),
        t('strategyPage.help.items.benchmark.what'),
        t('strategyPage.help.items.benchmark.why'),
        t('strategyPage.help.items.benchmark.how')
      ),
      weightMom6m: buildHelp(
        t('strategyPage.help.items.weightMom6m.title'),
        t('strategyPage.help.items.weightMom6m.short'),
        t('strategyPage.help.items.weightMom6m.what'),
        t('strategyPage.help.items.weightMom6m.why'),
        t('strategyPage.help.items.weightMom6m.how')
      ),
      weightMom12m: buildHelp(
        t('strategyPage.help.items.weightMom12m.title'),
        t('strategyPage.help.items.weightMom12m.short'),
        t('strategyPage.help.items.weightMom12m.what'),
        t('strategyPage.help.items.weightMom12m.why'),
        t('strategyPage.help.items.weightMom12m.how')
      ),
      weightRs: buildHelp(
        t('strategyPage.help.items.weightRs.title'),
        t('strategyPage.help.items.weightRs.short'),
        t('strategyPage.help.items.weightRs.what'),
        t('strategyPage.help.items.weightRs.why'),
        t('strategyPage.help.items.weightRs.how')
      ),
      trailSma: buildHelp(
        t('strategyPage.help.items.trailSma.title'),
        t('strategyPage.help.items.trailSma.short'),
        t('strategyPage.help.items.trailSma.what'),
        t('strategyPage.help.items.trailSma.why'),
        t('strategyPage.help.items.trailSma.how')
      ),
      smaBuffer: buildHelp(
        t('strategyPage.help.items.smaBuffer.title'),
        t('strategyPage.help.items.smaBuffer.short'),
        t('strategyPage.help.items.smaBuffer.what'),
        t('strategyPage.help.items.smaBuffer.why'),
        t('strategyPage.help.items.smaBuffer.how')
      ),
      regimeEnabled: buildHelp(
        t('strategyPage.help.items.regimeEnabled.title'),
        t('strategyPage.help.items.regimeEnabled.short'),
        t('strategyPage.help.items.regimeEnabled.what'),
        t('strategyPage.help.items.regimeEnabled.why'),
        t('strategyPage.help.items.regimeEnabled.how')
      ),
      regimeTrendSma: buildHelp(
        t('strategyPage.help.items.regimeTrendSma.title'),
        t('strategyPage.help.items.regimeTrendSma.short'),
        t('strategyPage.help.items.regimeTrendSma.what'),
        t('strategyPage.help.items.regimeTrendSma.why'),
        t('strategyPage.help.items.regimeTrendSma.how')
      ),
      regimeTrendMultiplier: buildHelp(
        t('strategyPage.help.items.regimeTrendMultiplier.title'),
        t('strategyPage.help.items.regimeTrendMultiplier.short'),
        t('strategyPage.help.items.regimeTrendMultiplier.what'),
        t('strategyPage.help.items.regimeTrendMultiplier.why'),
        t('strategyPage.help.items.regimeTrendMultiplier.how')
      ),
      regimeVolAtrWindow: buildHelp(
        t('strategyPage.help.items.regimeVolAtrWindow.title'),
        t('strategyPage.help.items.regimeVolAtrWindow.short'),
        t('strategyPage.help.items.regimeVolAtrWindow.what'),
        t('strategyPage.help.items.regimeVolAtrWindow.why'),
        t('strategyPage.help.items.regimeVolAtrWindow.how')
      ),
      regimeVolAtrPctThreshold: buildHelp(
        t('strategyPage.help.items.regimeVolAtrPctThreshold.title'),
        t('strategyPage.help.items.regimeVolAtrPctThreshold.short'),
        t('strategyPage.help.items.regimeVolAtrPctThreshold.what'),
        t('strategyPage.help.items.regimeVolAtrPctThreshold.why'),
        t('strategyPage.help.items.regimeVolAtrPctThreshold.how')
      ),
      regimeVolMultiplier: buildHelp(
        t('strategyPage.help.items.regimeVolMultiplier.title'),
        t('strategyPage.help.items.regimeVolMultiplier.short'),
        t('strategyPage.help.items.regimeVolMultiplier.what'),
        t('strategyPage.help.items.regimeVolMultiplier.why'),
        t('strategyPage.help.items.regimeVolMultiplier.how')
      ),
      socialOverlayEnabled: buildHelp(
        t('strategyPage.help.items.socialOverlayEnabled.title'),
        t('strategyPage.help.items.socialOverlayEnabled.short'),
        t('strategyPage.help.items.socialOverlayEnabled.what'),
        t('strategyPage.help.items.socialOverlayEnabled.why'),
        t('strategyPage.help.items.socialOverlayEnabled.how')
      ),
      lookbackHours: buildHelp(
        t('strategyPage.help.items.lookbackHours.title'),
        t('strategyPage.help.items.lookbackHours.short'),
        t('strategyPage.help.items.lookbackHours.what'),
        t('strategyPage.help.items.lookbackHours.why'),
        t('strategyPage.help.items.lookbackHours.how')
      ),
      attentionZThreshold: buildHelp(
        t('strategyPage.help.items.attentionZThreshold.title'),
        t('strategyPage.help.items.attentionZThreshold.short'),
        t('strategyPage.help.items.attentionZThreshold.what'),
        t('strategyPage.help.items.attentionZThreshold.why'),
        t('strategyPage.help.items.attentionZThreshold.how')
      ),
      minSampleSize: buildHelp(
        t('strategyPage.help.items.minSampleSize.title'),
        t('strategyPage.help.items.minSampleSize.short'),
        t('strategyPage.help.items.minSampleSize.what'),
        t('strategyPage.help.items.minSampleSize.why'),
        t('strategyPage.help.items.minSampleSize.how')
      ),
      negativeSentThreshold: buildHelp(
        t('strategyPage.help.items.negativeSentThreshold.title'),
        t('strategyPage.help.items.negativeSentThreshold.short'),
        t('strategyPage.help.items.negativeSentThreshold.what'),
        t('strategyPage.help.items.negativeSentThreshold.why'),
        t('strategyPage.help.items.negativeSentThreshold.how')
      ),
      sentimentConfThreshold: buildHelp(
        t('strategyPage.help.items.sentimentConfThreshold.title'),
        t('strategyPage.help.items.sentimentConfThreshold.short'),
        t('strategyPage.help.items.sentimentConfThreshold.what'),
        t('strategyPage.help.items.sentimentConfThreshold.why'),
        t('strategyPage.help.items.sentimentConfThreshold.how')
      ),
      hypePercentileThreshold: buildHelp(
        t('strategyPage.help.items.hypePercentileThreshold.title'),
        t('strategyPage.help.items.hypePercentileThreshold.short'),
        t('strategyPage.help.items.hypePercentileThreshold.what'),
        t('strategyPage.help.items.hypePercentileThreshold.why'),
        t('strategyPage.help.items.hypePercentileThreshold.how')
      ),
    }),
    [locale, t]
  );

  const {
    canCreate,
    createDescription,
    createId,
    createMutation,
    createName,
    deleteMutation,
    draft,
    handleCreate,
    handleDelete,
    handleReset,
    handleSave,
    handleSetActive,
    highFeeWarning,
    idAlreadyExists,
    isActive,
    lowRrWarning,
    selectedId,
    selectedStrategy,
    setCreateDescription,
    setCreateId,
    setCreateName,
    setDraft,
    setSelectedId,
    statusMessage,
    strategies,
    strategiesQuery,
    updateMutation,
  } = useStrategyEditor();

  const validationPayload = useMemo(
    () => (draft ? toStrategyUpdateRequest(draft) : null),
    [draft],
  );
  const strategyValidationQuery = useStrategyValidationQuery(validationPayload);
  const validationResult = strategyValidationQuery.data;
  const safetyScore = validationResult?.safetyScore ?? 100;

  useEffect(() => {
    if (saveGuardrailError && (advancedUnlocked || safetyScore >= MIN_SAFE_SCORE)) {
      setSaveGuardrailError(null);
    }
  }, [advancedUnlocked, safetyScore, saveGuardrailError]);

  useEffect(() => {
    localStorage.setItem(SCREENER_UNIVERSE_STORAGE_KEY, JSON.stringify(selectedReviewUniverse));
  }, [selectedReviewUniverse]);

  useEffect(() => {
    setAdvancedUnlocked(false);
    setSelectedPresetId('');
    setSaveGuardrailError(null);
  }, [selectedId]);

  const handleSaveWithGuardrails = () => {
    if (!draft) return;
    if (!advancedUnlocked && safetyScore < MIN_SAFE_SCORE) {
      setSaveGuardrailError(t('strategyPage.guardrails.beginnerBlocked'));
      return;
    }
    setSaveGuardrailError(null);
    handleSave();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('strategyPage.header.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('strategyPage.header.subtitle')}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            variant="secondary"
            onClick={handleReset}
            disabled={!draft || updateMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {t('strategyPage.actions.resetChanges')}
          </Button>
          <Button
            onClick={handleSaveWithGuardrails}
            disabled={!draft || updateMutation.isPending}
            className="flex-1 sm:flex-none"
          >
            {updateMutation.isPending ? t('strategyPage.actions.saving') : t('strategyPage.actions.saveChanges')}
          </Button>
        </div>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('strategyPage.selection.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:items-end">
            <label className="text-sm font-medium md:col-span-2">
              <div className="mb-2">{t('strategyPage.selection.chooseStrategy')}</div>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className={strategyFieldClass}
                disabled={strategiesQuery.isLoading}
              >
                {!strategies.length && (
                  <option value="">
                    {strategiesQuery.isLoading
                      ? t('strategyPage.selection.loadingStrategies')
                      : t('strategyPage.selection.noStrategies')}
                  </option>
                )}
                {strategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              <div className="mb-2">{t('strategyPage.core.fields.reviewUniverse')}</div>
              <select
                value={selectedReviewUniverse}
                onChange={(event) => setSelectedReviewUniverse(event.target.value)}
                className={strategyFieldClass}
              >
                {reviewUniverseOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleSetActive} disabled={!selectedStrategy || isActive}>
                {isActive ? t('strategyPage.selection.active') : t('strategyPage.selection.setActive')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={!selectedStrategy || selectedStrategy?.isDefault || deleteMutation.isPending}
              >
                {deleteMutation.isPending ? t('strategyPage.selection.deleting') : t('common.actions.delete')}
              </Button>
              {selectedStrategy?.isDefault && (
                <span className="text-xs text-gray-500">{t('strategyPage.selection.default')}</span>
              )}
            </div>
          </div>
          <div className="mt-5 border-t border-border pt-4 space-y-3">
            <div className="text-sm font-semibold">{t('strategyPage.create.title')}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextInput
                label={t('strategyPage.create.newId')}
                value={createId}
                onChange={(value) => setCreateId(value)}
                placeholder={t('strategyPage.create.newIdPlaceholder')}
              />
              <TextInput
                label={t('strategyPage.create.newName')}
                value={createName}
                onChange={(value) => setCreateName(value)}
                placeholder={t('strategyPage.create.newNamePlaceholder')}
              />
              <TextInput
                label={t('strategyPage.create.newDescription')}
                value={createDescription}
                onChange={(value) => setCreateDescription(value)}
                placeholder={t('strategyPage.create.newDescriptionPlaceholder')}
              />
            </div>
            {idAlreadyExists && (
              <div className="text-xs text-red-600">{t('strategyPage.create.idAlreadyExists')}</div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={!canCreate}>
                {createMutation.isPending ? t('strategyPage.actions.saving') : t('strategyPage.create.saveAsNew')}
              </Button>
              <div className="text-xs text-gray-500">
                {t('strategyPage.create.idHint')}
              </div>
            </div>
          </div>
          {saveGuardrailError ? (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
              {saveGuardrailError}
            </div>
          ) : null}
          {statusMessage && <div className="mt-3 text-sm text-green-600">{statusMessage}</div>}
          {updateMutation.isError && (
            <div className="mt-3 text-sm text-red-600">{t('strategyPage.errors.saveFailed')}</div>
          )}
          {createMutation.isError && (
            <div className="mt-3 text-sm text-red-600">
              {(createMutation.error as Error)?.message || t('strategyPage.errors.createFailed')}
            </div>
          )}
          {deleteMutation.isError && (
            <div className="mt-3 text-sm text-red-600">
              {(deleteMutation.error as Error)?.message || t('strategyPage.errors.deleteFailed')}
            </div>
          )}
        </CardContent>
      </Card>

      {!draft && (
        <Card variant="bordered">
          <CardContent>
            <div className="text-sm text-gray-500">{t('strategyPage.selection.selectToEdit')}</div>
          </CardContent>
        </Card>
      )}

      {draft && (
        <>
          {(() => {
            const strategyInfo = getStrategyInfo(draft.module ?? 'momentum');
            return strategyInfo ? <StrategyPhilosophyCard strategyInfo={strategyInfo} /> : null;
          })()}

          <StrategySafetyScore
            validation={validationResult}
            isLoading={strategyValidationQuery.isLoading || strategyValidationQuery.isFetching}
            isError={strategyValidationQuery.isError}
          />

          <Section title={t('strategyPage.simplified.sections.riskProfile')}>
            <Card variant="bordered">
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <NumberInput
                    label={t('strategyPage.core.fields.riskPerTrade')}
                    value={draft.risk.riskPct * 100}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        risk: { ...draft.risk, riskPct: value / 100 },
                      })
                    }
                    step={0.1}
                    min={0}
                    suffix="%"
                  />
                  <NumberInput
                    label={t('strategyPage.simplified.fields.targetRr')}
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
                    label={t('strategyPage.simplified.fields.maxOpenPositions')}
                    value={draft.ranking.topN}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        ranking: { ...draft.ranking, topN: value },
                      })
                    }
                    step={1}
                    min={1}
                  />
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section title={t('strategyPage.simplified.sections.entryLogic')}>
            <Card variant="bordered">
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SelectInput
                    label={t('strategyPage.simplified.fields.presetSelection')}
                    value={selectedPresetId}
                    onChange={(value) => {
                      setSelectedPresetId(value);
                      const preset = momentumPresets.find((item) => item.id === value);
                      if (!preset) return;
                      setDraft(applyPresetToStrategy(draft, preset));
                    }}
                    options={[
                      {
                        value: '',
                        label: t('strategyPage.simplified.fields.selectPresetPlaceholder'),
                      },
                      ...momentumPresets.map((preset) => ({
                        value: preset.id,
                        label: `${preset.icon} ${preset.name}`,
                      })),
                    ]}
                  />
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                    {t('strategyPage.simplified.hints.presetDerived')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section title={t('strategyPage.simplified.sections.exitLogic')}>
            <Card variant="bordered">
              <CardContent>
                <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-gray-500">{t('strategyPage.simplified.fields.breakevenAtR')}</div>
                    <div className="font-medium">{draft.manage.breakevenAtR.toFixed(1)}R</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">{t('strategyPage.simplified.fields.trailAfterR')}</div>
                    <div className="font-medium">{draft.manage.trailAfterR.toFixed(1)}R</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">{t('strategyPage.simplified.fields.maxHoldingDays')}</div>
                    <div className="font-medium">{draft.manage.maxHoldingDays}</div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  {t('strategyPage.simplified.hints.exitDerived')}
                </p>
              </CardContent>
            </Card>
          </Section>

          {!advancedUnlocked ? (
            <Section title={t('strategyPage.advancedUnlock.title')}>
              <p className="mb-4 text-gray-500 dark:text-gray-400">
                {t('strategyPage.advancedUnlock.description')}
              </p>
              <Button variant="secondary" onClick={() => setAdvancedUnlocked(true)}>
                {t('strategyPage.advancedUnlock.action')}
              </Button>
            </Section>
          ) : (
            <StrategyAdvancedSettingsCard
              draft={draft}
              setDraft={setDraft}
              lowRrWarning={lowRrWarning}
              highFeeWarning={highFeeWarning}
              help={help}
            />
          )}
        </>
      )}
    </div>
  );
}
