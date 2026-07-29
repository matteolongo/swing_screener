import { AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/i18n';

export default function IntradayBanner() {
  const { t } = useI18n();
  const mode = useAppStore((s) => s.mode);
  const bannerDismissed = useAppStore((s) => s.bannerDismissed);
  const setBannerDismissed = useAppStore((s) => s.setBannerDismissed);

  if (mode !== 'intraday' || bannerDismissed) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/30 text-warning text-xs">
      <AlertTriangle size={16} />
      <span className="flex-1">
        {t('intradayBanner.message')}
      </span>
      <button
        onClick={() => setBannerDismissed(true)}
        className="text-warning/70 hover:text-warning transition-colors"
        aria-label={t('intradayBanner.dismissAriaLabel')}
      >
        <X size={14} />
      </button>
    </div>
  );
}
