import { AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function IntradayBanner() {
  const mode = useAppStore((s) => s.mode);
  const bannerDismissed = useAppStore((s) => s.bannerDismissed);
  const setBannerDismissed = useAppStore((s) => s.setBannerDismissed);

  if (mode !== 'intraday' || bannerDismissed) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/30 text-warning text-xs">
      <AlertTriangle size={16} />
      <span className="flex-1">
        Intraday preview — read-only. End-of-day actions require final close data.
      </span>
      <button
        onClick={() => setBannerDismissed(true)}
        className="text-warning/70 hover:text-warning transition-colors"
        aria-label="Dismiss intraday banner"
      >
        <X size={14} />
      </button>
    </div>
  );
}
