import { useMemo } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useStrategyEditor } from '@/features/strategy/useStrategyEditor';
import StrategyAdvancedSettingsCard from '@/components/domain/strategy/StrategyAdvancedSettingsCard';
import StrategyCoreSettingsCards from '@/components/domain/strategy/StrategyCoreSettingsCards';
import { useI18n } from '@/i18n/I18nProvider';
import {
  buildHelp,
  strategyFieldClass,
  TextInput,
} from '@/components/domain/strategy/StrategyFieldControls';

export default function StrategyPage() {
  const { locale, t } = useI18n();

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
        t('strategyPage.help.items.breakoutLookback.how')
      ),
      pullbackMa: buildHelp(
        t('strategyPage.help.items.pullbackMa.title'),
        t('strategyPage.help.items.pullbackMa.short'),
        t('strategyPage.help.items.pullbackMa.what'),
        t('strategyPage.help.items.pullbackMa.why'),
        t('strategyPage.help.items.pullbackMa.how')
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
    setShowAdvanced,
    showAdvanced,
    statusMessage,
    strategies,
    strategiesQuery,
    updateMutation,
  } = useStrategyEditor();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('strategyPage.header.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('strategyPage.header.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleReset} disabled={!draft || updateMutation.isPending}>
            {t('strategyPage.actions.resetChanges')}
          </Button>
          <Button onClick={handleSave} disabled={!draft || updateMutation.isPending}>
            {updateMutation.isPending ? t('strategyPage.actions.saving') : t('strategyPage.actions.saveChanges')}
          </Button>
        </div>
      </div>

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('strategyPage.selection.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
          <StrategyCoreSettingsCards
            draft={draft}
            setDraft={setDraft}
            help={help}
          />

          <StrategyAdvancedSettingsCard
            draft={draft}
            setDraft={setDraft}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            lowRrWarning={lowRrWarning}
            highFeeWarning={highFeeWarning}
            help={help}
          />
        </>
      )}
    </div>
  );
}
