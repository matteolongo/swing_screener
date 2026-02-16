import ModalShell from '@/components/common/ModalShell';
import { t } from '@/i18n/t';

interface GettingStartedModalProps {
  onClose: () => void;
}

export default function GettingStartedModal({ onClose }: GettingStartedModalProps) {
  return (
    <ModalShell
      title={t('dashboardPage.gettingStarted.title')}
      onClose={onClose}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('dashboardPage.gettingStarted.subtitle')}
        </p>
        <ol className="list-decimal pl-5 space-y-3 text-sm">
          <li>
            {t('dashboardPage.gettingStarted.step1Prefix')}{' '}
            <a href="/settings" className="text-primary underline hover:text-primary/80" onClick={onClose}>
              {t('dashboardPage.gettingStarted.step1LinkLabel')}
            </a>{' '}
            {t('dashboardPage.gettingStarted.step1Suffix')}
          </li>
          <li>{t('dashboardPage.gettingStarted.step2')}</li>
          <li>{t('dashboardPage.gettingStarted.step3')}</li>
          <li>{t('dashboardPage.gettingStarted.step4')}</li>
        </ol>
        
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 You can access this guide anytime by clicking the "Getting Started" button in the header.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
