import { useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Calendar, Search, ShoppingCart } from 'lucide-react';
import Button from '@/components/common/Button';
import Card, { CardContent } from '@/components/common/Card';
import OnboardingStrategySetupStep from '@/components/domain/onboarding/OnboardingStrategySetupStep';
import { useStrategyReadiness } from '@/features/strategy/useStrategyReadiness';
import { t } from '@/i18n/t';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import { useOnboardingStore } from '@/stores/onboardingStore';

type OnboardingStep = {
  title: string;
  description: string;
  icon: typeof CheckCircle;
  content: ReactNode;
};

const STEPS: OnboardingStep[] = [
  {
    title: t('onboardingPage.steps.welcome.title'),
    description: t('onboardingPage.steps.welcome.description'),
    icon: CheckCircle,
    content: (
      <div className="space-y-4 text-sm text-gray-700">
        <p>{t('onboardingPage.steps.welcome.body')}</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t('onboardingPage.steps.welcome.items.configure')}</li>
          <li>{t('onboardingPage.steps.welcome.items.review')}</li>
          <li>{t('onboardingPage.steps.welcome.items.act')}</li>
          <li>{t('onboardingPage.steps.welcome.items.verify')}</li>
        </ol>
      </div>
    ),
  },
  {
    title: t('onboardingPage.steps.strategy.title'),
    description: t('onboardingPage.steps.strategy.description'),
    icon: CheckCircle,
    content: <OnboardingStrategySetupStep />,
  },
  {
    title: t('onboardingPage.steps.dailyReview.title'),
    description: t('onboardingPage.steps.dailyReview.description'),
    icon: Calendar,
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <p>{t('onboardingPage.steps.dailyReview.body')}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('onboardingPage.steps.dailyReview.items.candidates')}</li>
          <li>{t('onboardingPage.steps.dailyReview.items.updateStop')}</li>
          <li>{t('onboardingPage.steps.dailyReview.items.close')}</li>
          <li>{t('onboardingPage.steps.dailyReview.items.hold')}</li>
        </ul>
      </div>
    ),
  },
  {
    title: t('onboardingPage.steps.action.title'),
    description: t('onboardingPage.steps.action.description'),
    icon: ShoppingCart,
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <p>{t('onboardingPage.steps.action.body')}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('onboardingPage.steps.action.items.createOrder')}</li>
          <li>{t('onboardingPage.steps.action.items.updatePosition')}</li>
          <li>{t('onboardingPage.steps.action.items.noAction')}</li>
        </ul>
      </div>
    ),
  },
  {
    title: t('onboardingPage.steps.verify.title'),
    description: t('onboardingPage.steps.verify.description'),
    icon: Search,
    content: (
      <div className="space-y-3 text-sm text-gray-700">
        <p>{t('onboardingPage.steps.verify.body')}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('onboardingPage.steps.verify.items.orders')}</li>
          <li>{t('onboardingPage.steps.verify.items.positions')}</li>
        </ul>
      </div>
    ),
  },
];

function parseStep(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get('step');
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > STEPS.length) return null;
  return parsed - 1;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentStep, setCurrentStep, completeOnboarding, dismissOnboarding } = useOnboardingStore();
  const { isBeginnerMode, setBeginnerMode } = useBeginnerModeStore();
  const { isReady: strategyReady } = useStrategyReadiness();

  useEffect(() => {
    const requestedStep = parseStep(searchParams);
    if (requestedStep == null || requestedStep === currentStep) {
      return;
    }
    setCurrentStep(requestedStep);
  }, [currentStep, searchParams, setCurrentStep]);

  const stepIndex = Math.min(Math.max(currentStep, 0), STEPS.length - 1);
  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const isStrategyStep = stepIndex === 1;

  const canContinue = useMemo(() => {
    if (!isStrategyStep) {
      return true;
    }
    return strategyReady;
  }, [isStrategyStep, strategyReady]);

  const handleNext = () => {
    if (stepIndex >= STEPS.length - 1) {
      completeOnboarding();
      navigate('/workspace');
      return;
    }

    if (!canContinue) {
      return;
    }

    setCurrentStep(stepIndex + 1);
  };

  const handleBack = () => {
    if (stepIndex <= 0) return;
    setCurrentStep(stepIndex - 1);
  };

  const handleSkip = () => {
    dismissOnboarding();
    navigate('/workspace');
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-4xl flex-col gap-4 pb-20 lg:pb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold md:text-3xl">{t('onboardingPage.header.title')}</h1>
        <p className="text-sm text-gray-600">{t('onboardingPage.header.subtitle')}</p>
      </div>

      <Card variant="bordered">
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">{step.title}</h2>
          </div>

          <div>
            <p className="text-sm text-gray-600">{step.description}</p>
          </div>

          <div className="flex gap-2">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 flex-1 rounded-full ${index <= stepIndex ? 'bg-blue-600' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {t('onboardingPage.progress', { step: stepIndex + 1, total: STEPS.length })}
          </p>

          {stepIndex === 0 ? (
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="mb-2 text-sm font-medium text-gray-900">{t('onboardingPage.mode.title')}</p>
              <div className="flex gap-2">
                <Button
                  variant={isBeginnerMode ? 'primary' : 'secondary'}
                  onClick={() => setBeginnerMode(true)}
                  size="sm"
                >
                  {t('onboardingPage.mode.beginner')}
                </Button>
                <Button
                  variant={!isBeginnerMode ? 'primary' : 'secondary'}
                  onClick={() => setBeginnerMode(false)}
                  size="sm"
                >
                  {t('onboardingPage.mode.advanced')}
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-600">{t('onboardingPage.mode.hint')}</p>
            </div>
          ) : null}

          <div>{step.content}</div>

          {isStrategyStep && !strategyReady ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {t('onboardingPage.strategyStep.blockingHint')}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleSkip}>
                {t('onboardingPage.actions.skip')}
              </Button>
              {stepIndex > 0 ? (
                <Button variant="secondary" onClick={handleBack}>
                  {t('onboardingPage.actions.back')}
                </Button>
              ) : null}
            </div>

            <Button onClick={handleNext} disabled={!canContinue}>
              {stepIndex === STEPS.length - 1
                ? t('onboardingPage.actions.complete')
                : t('onboardingPage.actions.next')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
