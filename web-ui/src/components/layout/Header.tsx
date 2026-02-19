import { useState } from 'react';
import { TrendingUp, BookOpen, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n/I18nProvider';
import UserModeToggle from '@/components/common/UserModeToggle';
import Button from '@/components/common/Button';
import GettingStartedModal from '@/components/modals/GettingStartedModal';
import { clearSession } from '@/lib/auth';

export default function Header() {
  const now = new Date();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  
  const dateStr = now.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleLogout = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <header className="h-16 border-b border-border bg-white dark:bg-gray-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">{t('header.brand')}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <UserModeToggle />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowGettingStarted(true)}
            className="gap-2"
          >
            <BookOpen className="w-4 h-4" />
            {t('header.gettingStarted')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
          
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>📅 {dateStr}</span>
            <span className="font-mono">{timeStr}</span>
          </div>
        </div>
      </header>
      {showGettingStarted && (
        <GettingStartedModal onClose={() => setShowGettingStarted(false)} />
      )}
    </>
  );
}
