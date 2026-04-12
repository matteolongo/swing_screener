import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import OnboardingPage from './Onboarding';
import { useOnboardingStore } from '@/stores/onboardingStore';

const mockUseStrategyReadiness = vi.fn();

vi.mock('@/features/strategy/useStrategyReadiness', () => ({
  useStrategyReadiness: () => mockUseStrategyReadiness(),
}));

vi.mock('@/features/portfolio/hooks', () => ({
  useDegiroStatusQuery: () => ({
    data: {
      available: false,
      detail: 'DeGiro setup missing.',
    },
    isLoading: false,
    isError: false,
  }),
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

  it('renders the strategy step when current step is set to 2', async () => {
    useOnboardingStore.setState({ status: 'new', currentStep: 1 });
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    expect(await screen.findByText('Mock Strategy Setup Step')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
  });

  it('blocks progress on the strategy step when the method is not ready', async () => {
    useOnboardingStore.setState({ status: 'new', currentStep: 1 });
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    await screen.findByText('Step 2 of 4');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByText('Save a valid strategy before moving to the next onboarding step.')).toBeInTheDocument();
  });

  it('allows progress when the strategy is ready', async () => {
    mockUseStrategyReadiness.mockReturnValue({ isReady: true });
    useOnboardingStore.setState({ status: 'new', currentStep: 1 });
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' });

    await screen.findByText('Step 2 of 4');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    });
  });
});
