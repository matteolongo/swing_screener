import Button from '@/components/common/Button';
import { useDegiroStatusQuery } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function OnboardingExecutionSetupCard() {
  const { executionSetup, setExecutionSetup } = useOnboardingStore();
  const degiroStatusQuery = useDegiroStatusQuery();
  const degiroStatus = degiroStatusQuery.data;

  const isDegiro = executionSetup === 'degiro';
  const degiroReady = degiroStatus?.available === true;

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{t('onboardingPage.execution.title')}</p>
        <p className="mt-1 text-xs text-gray-600">{t('onboardingPage.execution.description')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={!isDegiro ? 'primary' : 'secondary'}
          onClick={() => setExecutionSetup('manual')}
        >
          {t('onboardingPage.execution.options.manual')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isDegiro ? 'primary' : 'secondary'}
          onClick={() => setExecutionSetup('degiro')}
        >
          {t('onboardingPage.execution.options.degiro')}
        </Button>
      </div>

      {!isDegiro ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <p className="font-medium">{t('onboardingPage.execution.manual.title')}</p>
          <p className="mt-1">{t('onboardingPage.execution.manual.body')}</p>
        </div>
      ) : (
        <div
          className={`rounded-md border p-3 text-sm ${
            degiroReady
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="font-medium">
            {degiroReady
              ? t('onboardingPage.execution.degiro.readyTitle')
              : t('onboardingPage.execution.degiro.setupTitle')}
          </p>
          <p className="mt-1">
            {degiroReady
              ? t('onboardingPage.execution.degiro.readyBody')
              : t('onboardingPage.execution.degiro.setupBody')}
          </p>
          {degiroStatus ? (
            <p className="mt-2 text-xs">{degiroStatus.detail}</p>
          ) : degiroStatusQuery.isLoading ? (
            <p className="mt-2 text-xs">{t('onboardingPage.execution.statusLoading')}</p>
          ) : degiroStatusQuery.isError ? (
            <p className="mt-2 text-xs">{t('onboardingPage.execution.statusError')}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
