import { useMemo, useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useStrategyEditor } from '@/features/strategy/useStrategyEditor';
import { useStrategyValidationQuery } from '@/features/strategy/hooks';
import { toStrategyUpdateRequest } from '@/features/strategy/types';
import StrategyAdvancedSettingsCard from '@/components/domain/strategy/StrategyAdvancedSettingsCard';
import StrategyCoreSettingsCards from '@/components/domain/strategy/StrategyCoreSettingsCards';
import StrategyPhilosophyCard from '@/components/domain/strategy/StrategyPhilosophyCard';
import StrategySafetyScore from '@/components/domain/strategy/StrategySafetyScore';
import StrategyCapitalRiskSummary from '@/components/domain/strategy/StrategyCapitalRiskSummary';
import { useI18n } from '@/i18n/I18nProvider';
import {
  buildHelp,
  TextInput,
} from '@/components/domain/strategy/StrategyFieldControls';
import Field from '@/components/common/Field';
import Select from '@/components/common/Select';
import { getStrategyInfo } from '@/content/strategy_docs/loader';

export default function StrategyPage() {
  const { locale, t } = useI18n();
  const [showStrategyManagement, setShowStrategyManagement] = useState(false);

  const help = useMemo(
    () => {
      const h = (key: string, hasExecution = false) => {
        const tk = (field: string) =>
          t(`strategyPage.help.items.${key}.${field}` as Parameters<typeof t>[0]);
        return buildHelp(tk('title'), tk('short'), tk('what'), tk('why'), tk('how'), hasExecution ? tk('execution') : undefined);
      };
      return {
        module: h('module'),
        breakoutLookback: h('breakoutLookback', true),
        pullbackMa: h('pullbackMa', true),
        minHistory: h('minHistory'),
        smaFast: h('smaFast'),
        smaMid: h('smaMid'),
        smaLong: h('smaLong'),
        atrWindow: h('atrWindow'),
        atrMultiplier: h('atrMultiplier'),
        minRr: h('minRr'),
        maxFeeRiskPct: h('maxFeeRiskPct'),
        maxAtrPct: h('maxAtrPct'),
        requireTrendOk: h('requireTrendOk'),
        requireRsPositive: h('requireRsPositive'),
        currencies: h('currencies'),
        momentum6m: h('momentum6m'),
        momentum12m: h('momentum12m'),
        benchmark: h('benchmark'),
        weightMom6m: h('weightMom6m'),
        weightMom12m: h('weightMom12m'),
        weightRs: h('weightRs'),
        trailSma: h('trailSma'),
        smaBuffer: h('smaBuffer'),
        regimeEnabled: h('regimeEnabled'),
        regimeTrendSma: h('regimeTrendSma'),
        regimeTrendMultiplier: h('regimeTrendMultiplier'),
        regimeVolAtrWindow: h('regimeVolAtrWindow'),
        regimeVolAtrPctThreshold: h('regimeVolAtrPctThreshold'),
        regimeVolMultiplier: h('regimeVolMultiplier'),
      };
    },
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

  const validationPayload = useMemo(
    () => (draft ? toStrategyUpdateRequest(draft) : null),
    [draft],
  );
  const strategyValidationQuery = useStrategyValidationQuery(validationPayload);
  const validationResult = strategyValidationQuery.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('strategyPage.header.title')}</h1>
          <p className="text-sm text-muted mt-1">{t('strategyPage.header.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleReset}
            disabled={!draft || updateMutation.isPending}
          >
            {t('strategyPage.actions.resetChanges')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!draft || updateMutation.isPending}
          >
            {updateMutation.isPending ? t('strategyPage.actions.saving') : t('strategyPage.actions.saveChanges')}
          </Button>
        </div>
      </div>

      <StrategyCapitalRiskSummary strategy={draft} />

      <Card variant="bordered">
        <CardHeader>
          <CardTitle>{t('strategyPage.selection.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <Field label={t('strategyPage.selection.chooseStrategy')} className="md:col-span-2">
              <Select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
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
              </Select>
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={handleSetActive} disabled={!selectedStrategy || isActive}>
                {isActive ? t('strategyPage.selection.active') : t('strategyPage.selection.setActive')}
              </Button>
              <Button variant="secondary" onClick={() => setShowStrategyManagement((value) => !value)}>
                {showStrategyManagement
                  ? t('strategyPage.selection.hideManageStrategies')
                  : t('strategyPage.selection.manageStrategies')}
              </Button>
            </div>
          </div>
          {showStrategyManagement && (
            <div className="mt-5 border-t border-border pt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={!selectedStrategy || selectedStrategy?.isDefault || deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? t('strategyPage.selection.deleting') : t('common.actions.delete')}
                </Button>
                {selectedStrategy?.isDefault && (
                  <span className="text-xs text-muted">{t('strategyPage.selection.default')}</span>
                )}
              </div>
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
                <div className="text-xs text-danger">{t('strategyPage.create.idAlreadyExists')}</div>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={handleCreate} disabled={!canCreate}>
                  {createMutation.isPending ? t('strategyPage.actions.saving') : t('strategyPage.create.saveAsNew')}
                </Button>
                <div className="text-xs text-muted">
                  {t('strategyPage.create.idHint')}
                </div>
              </div>
            </div>
          )}
          {statusMessage && <div className="mt-3 text-sm text-success">{statusMessage}</div>}
          {updateMutation.isError && (
            <div className="mt-3 text-sm text-danger">{t('strategyPage.errors.saveFailed')}</div>
          )}
          {createMutation.isError && (
            <div className="mt-3 text-sm text-danger">
              {(createMutation.error as Error)?.message || t('strategyPage.errors.createFailed')}
            </div>
          )}
          {deleteMutation.isError && (
            <div className="mt-3 text-sm text-danger">
              {(deleteMutation.error as Error)?.message || t('strategyPage.errors.deleteFailed')}
            </div>
          )}
        </CardContent>
      </Card>

      {!draft && (
        <Card variant="bordered">
          <CardContent>
            <div className="text-sm text-muted">{t('strategyPage.selection.selectToEdit')}</div>
          </CardContent>
        </Card>
      )}

      {draft && (
        <>
          {/* Strategy Philosophy Card - Shows the "Why" before the "What" */}
          {(() => {
            const strategyInfo = getStrategyInfo(draft.module ?? 'momentum');
            return strategyInfo ? <StrategyPhilosophyCard strategyInfo={strategyInfo} /> : null;
          })()}

          {/* Safety Score - Provides feedback on configuration quality */}
          <StrategySafetyScore
            validation={validationResult}
            isLoading={strategyValidationQuery.isLoading || strategyValidationQuery.isFetching}
            isError={strategyValidationQuery.isError}
          />

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
