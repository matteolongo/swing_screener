import { t } from '@/i18n/t';

export default function OnboardingExecutionSetupCard() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-foreground/5 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">{t('onboardingPage.execution.title')}</p>
        <p className="mt-1 text-xs text-muted">{t('onboardingPage.execution.description')}</p>
      </div>

      <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
        <p className="font-medium">{t('onboardingPage.execution.manual.title')}</p>
        <p className="mt-1">{t('onboardingPage.execution.manual.body')}</p>
      </div>
    </div>
  );
}
