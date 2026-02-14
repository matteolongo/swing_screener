import { useConfigStore } from '@/stores/configStore';
import HelpTooltip from '@/components/common/HelpTooltip';
import { t } from '@/i18n/t';

export default function IndicatorConfigForm() {
  const { config, updateIndicators } = useConfigStore();
  const { indicators } = config;

  return (
    <div className="space-y-6">
      {/* SMA Windows */}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          {t('settingsPage.indicatorForm.smaWindows.label')}
          <HelpTooltip
            short={t('settingsPage.indicatorForm.smaWindows.tooltip.short')}
            title={t('settingsPage.indicatorForm.smaWindows.tooltip.title')}
            content={
              <div className="space-y-4">
                <p>
                  {t('settingsPage.indicatorForm.smaWindows.tooltip.content.intro')}
                </p>
                <div>
                  <h4 className="font-semibold mb-2">{t('settingsPage.indicatorForm.common.formula')}</h4>
                  <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                    {t('settingsPage.indicatorForm.smaWindows.tooltip.content.formulaValue')}
                  </code>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">{t('settingsPage.indicatorForm.smaWindows.tooltip.content.standardWindowsTitle')}</h4>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>SMA20:</strong> {t('settingsPage.indicatorForm.smaWindows.tooltip.content.sma20')}</li>
                    <li><strong>SMA50:</strong> {t('settingsPage.indicatorForm.smaWindows.tooltip.content.sma50')}</li>
                    <li><strong>SMA200:</strong> {t('settingsPage.indicatorForm.smaWindows.tooltip.content.sma200')}</li>
                  </ul>
                </div>
                <div className="bg-primary/10 border border-primary/30 rounded p-4">
                  <p className="font-semibold">{t('settingsPage.indicatorForm.smaWindows.tooltip.content.howWeUseTitle')}</p>
                  <p className="text-sm mt-2">
                    {t('settingsPage.indicatorForm.smaWindows.tooltip.content.howWeUseLine1')}<br />
                    {t('settingsPage.indicatorForm.smaWindows.tooltip.content.howWeUseLine2')}<br />
                    {t('settingsPage.indicatorForm.smaWindows.tooltip.content.howWeUseLine3')}
                  </p>
                </div>
              </div>
            }
          />
        </label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">{t('settingsPage.indicatorForm.smaWindows.fast')}</label>
            <input
              type="number"
              value={indicators.smaFast}
              onChange={(e) => updateIndicators({ smaFast: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="5"
              max="50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">{t('settingsPage.indicatorForm.smaWindows.mid')}</label>
            <input
              type="number"
              value={indicators.smaMid}
              onChange={(e) => updateIndicators({ smaMid: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="20"
              max="100"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">{t('settingsPage.indicatorForm.smaWindows.long')}</label>
            <input
              type="number"
              value={indicators.smaLong}
              onChange={(e) => updateIndicators({ smaLong: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="100"
              max="300"
            />
          </div>
        </div>
      </div>

      {/* ATR Window */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            {t('settingsPage.indicatorForm.atrWindow.label')}
            <HelpTooltip
              short={t('settingsPage.indicatorForm.atrWindow.tooltip.short')}
              title={t('settingsPage.indicatorForm.atrWindow.tooltip.title')}
              content={
                <div className="space-y-4">
                  <p>
                    {t('settingsPage.indicatorForm.atrWindow.tooltip.content.intro')}
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.indicatorForm.atrWindow.tooltip.content.standardTitle')}</h4>
                    <p className="text-sm">
                      {t('settingsPage.indicatorForm.atrWindow.tooltip.content.standardBody')}
                    </p>
                  </div>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={indicators.atrWindow}
            onChange={(e) => updateIndicators({ atrWindow: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-border rounded-lg"
            min="7"
            max="30"
          />
        </div>
      </div>

      {/* Entry Signal Windows */}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          {t('settingsPage.indicatorForm.entrySignalWindows.label')}
          <HelpTooltip
            short={t('settingsPage.indicatorForm.entrySignalWindows.tooltip.short')}
            title={t('settingsPage.indicatorForm.entrySignalWindows.tooltip.title')}
            content={
              <div className="space-y-4">
                <p>
                  {t('settingsPage.indicatorForm.entrySignalWindows.tooltip.content.intro')}
                </p>
                <div>
                  <h4 className="font-semibold mb-2">{t('settingsPage.indicatorForm.entrySignalWindows.tooltip.content.breakoutTitle')}</h4>
                  <p className="text-sm">
                    {t('settingsPage.indicatorForm.entrySignalWindows.tooltip.content.breakoutBody')}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">{t('settingsPage.indicatorForm.entrySignalWindows.tooltip.content.pullbackTitle')}</h4>
                  <p className="text-sm">
                    {t('settingsPage.indicatorForm.entrySignalWindows.tooltip.content.pullbackBody')}
                  </p>
                </div>
              </div>
            }
          />
        </label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">{t('settingsPage.indicatorForm.entrySignalWindows.breakoutLookback')}</label>
            <input
              type="number"
              value={indicators.breakoutLookback}
              onChange={(e) => updateIndicators({ breakoutLookback: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="10"
              max="200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">{t('settingsPage.indicatorForm.entrySignalWindows.pullbackMa')}</label>
            <input
              type="number"
              value={indicators.pullbackMa}
              onChange={(e) => updateIndicators({ pullbackMa: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="5"
              max="100"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">{t('settingsPage.indicatorForm.entrySignalWindows.minHistory')}</label>
            <input
              type="number"
              value={indicators.minHistory}
              onChange={(e) => updateIndicators({ minHistory: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="50"
              max="500"
            />
          </div>
        </div>
      </div>

      {/* Momentum Lookback */}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          {t('settingsPage.indicatorForm.momentumLookback.label')}
          <HelpTooltip
            short={t('settingsPage.indicatorForm.momentumLookback.tooltip.short')}
            title={t('settingsPage.indicatorForm.momentumLookback.tooltip.title')}
            content={
              <div className="space-y-4">
                <p>
                  {t('settingsPage.indicatorForm.momentumLookback.tooltip.content.intro')}
                </p>
                <div>
                  <h4 className="font-semibold mb-2">{t('settingsPage.indicatorForm.momentumLookback.tooltip.content.tradingDaysTitle')}</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>{t('settingsPage.indicatorForm.momentumLookback.tooltip.content.tradingDays126')}</li>
                    <li>{t('settingsPage.indicatorForm.momentumLookback.tooltip.content.tradingDays252')}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">{t('settingsPage.indicatorForm.common.formula')}</h4>
                  <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                    {t('settingsPage.indicatorForm.momentumLookback.tooltip.content.formulaValue')}
                  </code>
                </div>
                <div className="bg-primary/10 border border-primary/30 rounded p-4">
                  <p className="font-semibold">{t('settingsPage.indicatorForm.momentumLookback.tooltip.content.whyTitle')}</p>
                  <p className="text-sm mt-2">
                    {t('settingsPage.indicatorForm.momentumLookback.tooltip.content.whyBody')}
                  </p>
                </div>
              </div>
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">{t('settingsPage.indicatorForm.momentumLookback.sixMonths')}</label>
            <input
              type="number"
              value={indicators.lookback6m}
              onChange={(e) => updateIndicators({ lookback6m: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="60"
              max="200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">{t('settingsPage.indicatorForm.momentumLookback.twelveMonths')}</label>
            <input
              type="number"
              value={indicators.lookback12m}
              onChange={(e) => updateIndicators({ lookback12m: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="200"
              max="300"
            />
          </div>
        </div>
      </div>

      {/* Benchmark */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            {t('settingsPage.indicatorForm.benchmark.label')}
            <HelpTooltip
              short={t('settingsPage.indicatorForm.benchmark.tooltip.short')}
              title={t('settingsPage.indicatorForm.benchmark.tooltip.title')}
              content={
                <div className="space-y-4">
                  <p>
                    {t('settingsPage.indicatorForm.benchmark.tooltip.content.intro')}
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.indicatorForm.common.formula')}</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      {t('settingsPage.indicatorForm.benchmark.tooltip.content.formulaValue')}
                    </code>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{t('settingsPage.indicatorForm.common.example')}</h4>
                    <p className="text-sm">
                      {t('settingsPage.indicatorForm.benchmark.tooltip.content.exampleLine1')}<br />
                      {t('settingsPage.indicatorForm.benchmark.tooltip.content.exampleLine2')}
                    </p>
                  </div>
                  <p className="text-sm">
                    {t('settingsPage.indicatorForm.benchmark.tooltip.content.defaultPrefix')} <strong>SPY</strong> {t('settingsPage.indicatorForm.benchmark.tooltip.content.defaultSuffix')}
                  </p>
                </div>
              }
            />
          </label>
          <input
            type="text"
            value={indicators.benchmark}
            onChange={(e) => updateIndicators({ benchmark: e.target.value.toUpperCase() })}
            className="w-full px-4 py-2 border border-border rounded-lg uppercase"
            placeholder={t('settingsPage.indicatorForm.benchmark.placeholder')}
          />
        </div>
      </div>
    </div>
  );
}
