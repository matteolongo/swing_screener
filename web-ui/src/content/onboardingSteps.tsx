import type { ReactNode } from 'react';
import { CheckCircle, Calendar, Search, ShoppingCart } from 'lucide-react';
import OnboardingStrategySetupStep from '@/components/domain/onboarding/OnboardingStrategySetupStep';
import { t } from '@/i18n/t';

export type OnboardingStep = {
  title: string;
  description: string;
  icon: typeof CheckCircle;
  content: ReactNode;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
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
