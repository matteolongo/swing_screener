import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import { useI18n } from '../../i18n';

export default function ModeToggle() {
  const { mode, setMode } = useAppStore();
  const { t } = useI18n();

  return (
    <div className="flex rounded border border-border overflow-hidden" style={{ width: '120px' }}>
      <button
        onClick={() => setMode('eod')}
        className={clsx(
          'flex-1 py-1.5 text-[11px] font-medium transition-colors',
          mode === 'eod'
            ? 'bg-accent text-white'
            : 'bg-transparent text-text-secondary hover:text-text-primary',
        )}
      >
        {t('mode.eod')}
      </button>
      <button
        onClick={() => setMode('intraday')}
        className={clsx(
          'flex-1 py-1.5 text-[11px] font-medium transition-colors',
          mode === 'intraday'
            ? 'bg-accent text-white'
            : 'bg-transparent text-text-secondary hover:text-text-primary',
        )}
      >
        {t('mode.intraday')}
      </button>
    </div>
  );
}
