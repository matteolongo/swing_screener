import { TrendingUp } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import UserModeToggle from '@/components/common/UserModeToggle';

export default function Header() {
  const now = new Date();
  const { locale, t } = useI18n();
  const dateStr = now.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="h-16 border-b border-border bg-white dark:bg-gray-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold">{t('header.brand')}</h1>
      </div>
      
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <UserModeToggle />
        <span>📅 {dateStr}</span>
        <span className="font-mono">{timeStr}</span>
      </div>
    </header>
  );
}
