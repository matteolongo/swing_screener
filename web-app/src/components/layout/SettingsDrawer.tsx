import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useI18n } from '../../i18n';

const alertLabelsConfig: { key: string; i18nKey: string }[] = [
  { key: 'exhaustion', i18nKey: 'settings.alerts.exhaustion' },
  { key: 'stop-trigger', i18nKey: 'settings.alerts.stopTrigger' },
  { key: 'concentration', i18nKey: 'settings.alerts.concentration' },
  { key: 'provider-failure', i18nKey: 'settings.alerts.providerFailure' },
  { key: 'intraday-rr', i18nKey: 'settings.alerts.intradayRRChange' },
];

export default function SettingsDrawer() {
  const { t } = useI18n();
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const accountSize = useAppStore((s) => s.accountSize);
  const setAccountSize = useAppStore((s) => s.setAccountSize);

  const intradayNewsWindow = useSettingsStore((s) => s.intradayNewsWindow);
  const setIntradayNewsWindow = useSettingsStore((s) => s.setIntradayNewsWindow);
  const alertToggles = useSettingsStore((s) => s.alertToggles);
  const toggleAlert = useSettingsStore((s) => s.toggleAlert);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);

  const [visible, setVisible] = useState(false);
  const [localAccountSize, setLocalAccountSize] = useState(accountSize);

  useEffect(() => {
    if (drawerOpen) {
      setLocalAccountSize(accountSize);
      const timer = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(timer);
    }
    setVisible(false);
  }, [drawerOpen, accountSize]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => setDrawerOpen(false), 300);
  };

  const handleBackdropClick = () => {
    handleClose();
  };

  const handleSaveAccountSize = () => {
    setAccountSize(localAccountSize);
  };

  if (!drawerOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleBackdropClick}
      />
      <div
        className="fixed right-0 top-0 w-[440px] h-full bg-surface z-50 border-l border-border shadow-2xl transition-transform duration-300 overflow-y-auto"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">{t('settings.title')}</h2>
            <button
              onClick={handleClose}
              className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Account Settings */}
          <section>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3 pb-2 border-b border-border">
              {t('settings.account.title')}
            </h3>
            <div className="space-y-2">
              <label className="text-sm text-text-primary">{t('settings.account.accountSize')}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">$</span>
                  <input
                    type="number"
                    value={localAccountSize}
                    onChange={(e) => setLocalAccountSize(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 rounded bg-bg-elevated border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={handleSaveAccountSize}
                  disabled={localAccountSize === accountSize}
                  className="px-4 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('settings.account.save')}
                </button>
              </div>
            </div>
          </section>

          {/* Intraday Settings */}
          <section>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3 pb-2 border-b border-border">
              {t('settings.intraday.title')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-text-primary" htmlFor="news-window">
                  {t('settings.intraday.newsWindow')}
                </label>
                <input
                  id="news-window"
                  type="number"
                  value={intradayNewsWindow}
                  onChange={(e) => setIntradayNewsWindow(Number(e.target.value))}
                  min={1}
                  max={24}
                  className="w-full mt-1 px-3 py-2 rounded bg-bg-elevated border border-border text-text-primary text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div className="opacity-40">
                <label className="text-sm text-text-primary">{t('settings.intraday.intradayMode')}</label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="w-9 h-5 rounded-full bg-bg-elevated border border-border" />
                  <span className="text-xs text-text-secondary">{t('settings.intraday.comingSoon')}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Alert Toggles */}
          <section>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3 pb-2 border-b border-border">
              {t('settings.alerts.title')}
            </h3>
            <div className="space-y-2">
              {alertLabelsConfig.map(({ key, i18nKey }) => (
                <label
                  key={key}
                  className="flex items-center justify-between py-1.5 cursor-pointer"
                >
                  <span className="text-sm text-text-primary">{t(i18nKey)}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alertToggles[key] ?? true}
                    onClick={() => toggleAlert(key)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      (alertToggles[key] ?? true) ? 'bg-accent' : 'bg-bg-elevated border border-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        (alertToggles[key] ?? true) ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          </section>

          {/* Sound */}
          <section>
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3 pb-2 border-b border-border">
              {t('settings.sound.title')}
            </h3>
            <label className="flex items-center justify-between py-1.5 cursor-pointer">
              <span className="text-sm text-text-primary">{t('settings.sound.enabled')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={soundEnabled}
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  soundEnabled ? 'bg-accent' : 'bg-bg-elevated border border-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
          </section>
        </div>
      </div>
    </>
  );
}
