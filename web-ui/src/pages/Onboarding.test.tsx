import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OnboardingPage from './Onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { t } from '@/i18n/t';

const mockUseStrategyReadiness = vi.fn();

vi.mock('@/features/strategy/useStrategyReadiness', () => ({
  useStrategyReadiness: () => mockUseStrategyReadiness(),
}));


vi.mock('@/components/domain/onboarding/OnboardingStrategySetupStep', () => ({
  default: () => <div>Mock Strategy Setup Step</div>,
}));

describe('OnboardingPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useOnboardingStore.setState({ status: 'new', currentStep: 0 });
    mockUseStrategyReadiness.mockReturnValue({ isReady: false });
  });

  it('renders strategy step when current step is set to 2', async () => {
    useOnboardingStore.setState({ status: 'new', currentStep: 1 });
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    expect(await screen.findByText('Mock Strategy Setup Step')).toBeInTheDocument();
    expect(screen.getByText(t('onboardingPage.progress', { step: 2, total: 5 }))).toBeInTheDocument();
  });

  it('blocks progress on strategy step when strategy is not ready', async () => {
    useOnboardingStore.setState({ status: 'new', currentStep: 1 });
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    await screen.findByText(t('onboardingPage.progress', { step: 2, total: 5 }));
    const nextButton = screen.getByRole('button', { name: t('onboardingPage.actions.next') });
    expect(nextButton).toBeDisabled();
    expect(
	      screen.getByText(t('onboardingPage.strategyStep.blockingHint')),
    ).toBeInTheDocument();
  });

  it('allows progress when strategy is ready', async () => {
    mockUseStrategyReadiness.mockReturnValue({ isReady: true });
    useOnboardingStore.setState({ status: 'new', currentStep: 1 });
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    await screen.findByText(t('onboardingPage.progress', { step: 2, total: 5 }));
    fireEvent.click(screen.getByRole('button', { name: t('onboardingPage.actions.next') }));

    await waitFor(() => {
      expect(screen.getByText(t('onboardingPage.progress', { step: 3, total: 5 }))).toBeInTheDocument();
    });
  });

  it('completes onboarding from the last step', async () => {
    mockUseStrategyReadiness.mockReturnValue({ isReady: true });
    useOnboardingStore.setState({ status: 'new', currentStep: 4 });

    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    fireEvent.click(screen.getByRole('button', { name: t('onboardingPage.actions.complete') }));

    await waitFor(() => {
      expect(useOnboardingStore.getState().status).toBe('completed');
    });
  });

  it('asks for broker workflow on the verify step', async () => {
    mockUseStrategyReadiness.mockReturnValue({ isReady: true });
    useOnboardingStore.setState({ status: 'new', currentStep: 4, executionSetup: 'manual' });

    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    expect(await screen.findByText(t('onboardingPage.execution.title'))).toBeInTheDocument();
    expect(screen.getByText(t('onboardingPage.execution.manual.title'))).toBeInTheDocument();
  });
});
