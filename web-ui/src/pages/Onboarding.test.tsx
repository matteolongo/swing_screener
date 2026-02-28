import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OnboardingPage from './Onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';

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
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
  });

  it('blocks progress on strategy step when strategy is not ready', async () => {
    useOnboardingStore.setState({ status: 'new', currentStep: 1 });
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    await screen.findByText('Step 2 of 5');
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
    expect(
      screen.getByText('Save a valid strategy before moving to the next onboarding step.'),
    ).toBeInTheDocument();
  });

  it('allows progress when strategy is ready', async () => {
    mockUseStrategyReadiness.mockReturnValue({ isReady: true });
    useOnboardingStore.setState({ status: 'new', currentStep: 1 });
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    await screen.findByText('Step 2 of 5');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    });
  });

  it('completes onboarding from the last step', async () => {
    mockUseStrategyReadiness.mockReturnValue({ isReady: true });
    useOnboardingStore.setState({ status: 'new', currentStep: 4 });

    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));

    await waitFor(() => {
      expect(useOnboardingStore.getState().status).toBe('completed');
    });
  });
});
