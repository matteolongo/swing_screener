import { t } from '@/i18n/t';

export default function OnboardingExecutionSetupCard() {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{t('onboardingPage.execution.title')}</p>
        <p className="mt-1 text-xs text-gray-600">{t('onboardingPage.execution.description')}</p>
      </div>

      <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <p className="font-medium">{t('onboardingPage.execution.manual.title')}</p>
        <p className="mt-1">{t('onboardingPage.execution.manual.body')}</p>
      </div>
    </div>
  );
}
