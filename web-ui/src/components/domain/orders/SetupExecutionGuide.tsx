import { getSetupExecutionGuidance } from '@/features/orders/setupGuidance';
import { t } from '@/i18n/t';

interface SetupExecutionGuideProps {
  signal?: string | null;
}

export default function SetupExecutionGuide({ signal }: SetupExecutionGuideProps) {
  const guidance = getSetupExecutionGuidance(signal);

  return (
    <div className="rounded border border-primary/40 bg-primary/10 p-3 text-xs text-primary">
      <p className="font-semibold">{t('order.setupGuidance.title')}</p>
      <p className="mt-1">
        <span className="font-semibold">{t('order.setupGuidance.setupLabel')}</span> {t(guidance.setupLabelKey)}
      </p>
      <p className="mt-1">
        <span className="font-semibold">{t('order.setupGuidance.whatItMeans')}</span> {t(guidance.whatItMeansKey)}
      </p>
      <p className="mt-2 font-semibold">{t('order.setupGuidance.stepsLabel')}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {guidance.stepsKeys.map((stepKey) => (
          <li key={stepKey}>{t(stepKey)}</li>
        ))}
      </ul>
      <p className="mt-2">
        <span className="font-semibold">{t('order.setupGuidance.cautionLabel')}</span> {t(guidance.cautionKey)}
      </p>
    </div>
  );
}
