import { useState } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { useStrategyEditor } from '@/features/strategy/useStrategyEditor';
import StrategyAdvancedSettingsCard from '@/components/domain/strategy/StrategyAdvancedSettingsCard';
import StrategyCoreSettingsCards from '@/components/domain/strategy/StrategyCoreSettingsCards';
import StrategyCapitalRiskSummary from '@/components/domain/strategy/StrategyCapitalRiskSummary';
import { useI18n } from '@/i18n/I18nProvider';
import { TextInput } from '@/components/domain/strategy/StrategyFieldControls';
import Field from '@/components/common/Field';
import Select from '@/components/common/Select';

export default function StrategyPage() {
  const { t } = useI18n();
  const [showStrategyManagement, setShowStrategyManagement] = useState(false);

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
          <StrategyCoreSettingsCards
            draft={draft}
            setDraft={setDraft}
          />

          <StrategyAdvancedSettingsCard
            draft={draft}
            setDraft={setDraft}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            lowRrWarning={lowRrWarning}
            highFeeWarning={highFeeWarning}
          />
        </>
      )}
    </div>
  );
}
