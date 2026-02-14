import { useConfigStore } from '@/stores/configStore';
import HelpTooltip from '@/components/common/HelpTooltip';
import { t } from '@/i18n/t';

export default function ManageConfigForm() {
  const { config, updateManage } = useConfigStore();
  const { manage } = config;

  return (
    <div className="space-y-6">
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-6">
        <p className="text-sm font-semibold">{t('settingsPage.manageForm.intro')}</p>
      </div>

      {/* Breakeven at R */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            {t('settingsPage.manageForm.breakeven.label')}
            <HelpTooltip
              short={t('settingsPage.manageForm.breakeven.tooltip.short')}
              title={t('settingsPage.manageForm.breakeven.tooltip.title')}
              content={
                <div className="space-y-4">
                  <p>
                    {t('settingsPage.manageForm.breakeven.tooltip.content.intro')}
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.manageForm.breakeven.tooltip.content.whyTitle')}</h4>
                    <p className="text-sm">
                      {t('settingsPage.manageForm.breakeven.tooltip.content.whyBody')}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.manageForm.common.example')}</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      {t('settingsPage.manageForm.breakeven.tooltip.content.exampleLine1')}<br />
                      {t('settingsPage.manageForm.breakeven.tooltip.content.exampleLine2')}<br />
                      {t('settingsPage.manageForm.breakeven.tooltip.content.exampleLine3')}
                    </code>
                  </div>
                  <div className="bg-success/10 border border-success/30 rounded p-4">
                    <p className="font-semibold text-success-foreground">{t('settingsPage.manageForm.breakeven.tooltip.content.goldenRuleTitle')}</p>
                    <p className="text-sm mt-2">
                      {t('settingsPage.manageForm.breakeven.tooltip.content.goldenRuleBody')}
                    </p>
                  </div>
                </div>
              }
            />
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={manage.breakevenAtR}
              onChange={(e) => updateManage({ breakevenAtR: Number(e.target.value) })}
              className="w-32 px-4 py-2 border border-border rounded-lg"
              min="0.5"
              max="2"
              step="0.1"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.manageForm.common.rUnit')}</span>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          {t('settingsPage.manageForm.breakeven.defaultHint')}
        </div>
      </div>

      {/* Trail After R */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            {t('settingsPage.manageForm.trailAfter.label')}
            <HelpTooltip
              short={t('settingsPage.manageForm.trailAfter.tooltip.short')}
              title={t('settingsPage.manageForm.trailAfter.tooltip.title')}
              content={
                <div className="space-y-4">
                  <p>
                    {t('settingsPage.manageForm.trailAfter.tooltip.content.intro')}
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.manageForm.trailAfter.tooltip.content.whyTitle')}</h4>
                    <p className="text-sm">
                      {t('settingsPage.manageForm.trailAfter.tooltip.content.whyBody')}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.manageForm.trailAfter.tooltip.content.howTitle')}</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      {t('settingsPage.manageForm.trailAfter.tooltip.content.howLine1')}<br />
                      {t('settingsPage.manageForm.trailAfter.tooltip.content.howLine2')}
                    </code>
                  </div>
                  <div className="bg-primary/10 border border-primary/30 rounded p-4">
                    <p className="font-semibold">{t('settingsPage.manageForm.trailAfter.tooltip.content.tipTitle')}</p>
                    <p className="text-sm mt-2">
                      {t('settingsPage.manageForm.trailAfter.tooltip.content.tipBody')}
                    </p>
                  </div>
                </div>
              }
            />
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={manage.trailAfterR}
              onChange={(e) => updateManage({ trailAfterR: Number(e.target.value) })}
              className="w-32 px-4 py-2 border border-border rounded-lg"
              min="1"
              max="5"
              step="0.5"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.manageForm.common.rUnit')}</span>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          {t('settingsPage.manageForm.trailAfter.defaultHint')}
        </div>
      </div>

      {/* Trail SMA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            {t('settingsPage.manageForm.trailSma.label')}
            <HelpTooltip
              short={t('settingsPage.manageForm.trailSma.tooltip.short')}
              title={t('settingsPage.manageForm.trailSma.tooltip.title')}
              content={
                <div className="space-y-4">
                  <p>
                    {t('settingsPage.manageForm.trailSma.tooltip.content.intro')}
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.manageForm.trailSma.tooltip.content.whyTitle')}</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>{t('settingsPage.manageForm.trailSma.tooltip.content.whyPoint1')}</li>
                      <li>{t('settingsPage.manageForm.trailSma.tooltip.content.whyPoint2')}</li>
                      <li>{t('settingsPage.manageForm.trailSma.tooltip.content.whyPoint3')}</li>
                      <li>{t('settingsPage.manageForm.trailSma.tooltip.content.whyPoint4')}</li>
                    </ul>
                  </div>
                  <p className="text-sm">
                    {t('settingsPage.manageForm.trailSma.tooltip.content.note')}
                  </p>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={manage.trailSma}
            onChange={(e) => updateManage({ trailSma: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-border rounded-lg"
            min="5"
            max="50"
          />
        </div>
      </div>

      {/* SMA Buffer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            {t('settingsPage.manageForm.smaBuffer.label')}
            <HelpTooltip
              short={t('settingsPage.manageForm.smaBuffer.tooltip.short')}
              title={t('settingsPage.manageForm.smaBuffer.tooltip.title')}
              content={
                <div className="space-y-4">
                  <p>
                    {t('settingsPage.manageForm.smaBuffer.tooltip.content.intro')}
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.manageForm.common.formula')}</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      {t('settingsPage.manageForm.smaBuffer.tooltip.content.formulaValue')}
                    </code>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.manageForm.common.example')}</h4>
                    <p className="text-sm">
                      {t('settingsPage.manageForm.smaBuffer.tooltip.content.exampleLine1')}<br />
                      {t('settingsPage.manageForm.smaBuffer.tooltip.content.exampleLine2')}<br />
                      <strong>{t('settingsPage.manageForm.smaBuffer.tooltip.content.exampleLine3')}</strong>
                    </p>
                  </div>
                  <p className="text-sm">
                    {t('settingsPage.manageForm.smaBuffer.tooltip.content.note')}
                  </p>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={manage.smaBufferPct * 100}
            onChange={(e) => updateManage({ smaBufferPct: Number(e.target.value) / 100 })}
            className="w-full px-4 py-2 border border-border rounded-lg"
            min="0"
            max="2"
            step="0.1"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          {t('settingsPage.manageForm.smaBuffer.defaultHint')}
        </div>
      </div>

      {/* Max Holding Days */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            {t('settingsPage.manageForm.maxHolding.label')}
            <HelpTooltip
              short={t('settingsPage.manageForm.maxHolding.tooltip.short')}
              title={t('settingsPage.manageForm.maxHolding.tooltip.title')}
              content={
                <div className="space-y-4">
                  <p>
                    {t('settingsPage.manageForm.maxHolding.tooltip.content.intro')}
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.manageForm.maxHolding.tooltip.content.whyTitle')}</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>{t('settingsPage.manageForm.maxHolding.tooltip.content.whyPoint1')}</li>
                      <li>{t('settingsPage.manageForm.maxHolding.tooltip.content.whyPoint2')}</li>
                      <li>{t('settingsPage.manageForm.maxHolding.tooltip.content.whyPoint3')}</li>
                      <li>{t('settingsPage.manageForm.maxHolding.tooltip.content.whyPoint4')}</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.manageForm.maxHolding.tooltip.content.typicalRangeTitle')}</h4>
                    <p className="text-sm">
                      {t('settingsPage.manageForm.maxHolding.tooltip.content.typicalRangeBody')}
                    </p>
                  </div>
                  <div className="bg-warning/10 border border-warning/30 rounded p-4">
                    <p className="font-semibold text-warning-foreground">{t('settingsPage.manageForm.maxHolding.tooltip.content.noteTitle')}</p>
                    <p className="text-sm mt-2">
                      {t('settingsPage.manageForm.maxHolding.tooltip.content.noteBody')}
                    </p>
                  </div>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={manage.maxHoldingDays}
            onChange={(e) => updateManage({ maxHoldingDays: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-border rounded-lg"
            min="5"
            max="60"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          {t('settingsPage.manageForm.maxHolding.defaultHint')}
        </div>
      </div>
    </div>
  );
}
