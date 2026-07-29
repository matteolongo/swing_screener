import { Settings } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/i18n';

export default function ProfileMenu() {
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  const { t } = useI18n();

  return (
    <button
      onClick={toggleDrawer}
      className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
      title={t('settings.profileMenuTitle')}
    >
      <Settings size={16} />
    </button>
  );
}
