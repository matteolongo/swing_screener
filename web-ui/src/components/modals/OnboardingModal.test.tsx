import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import OnboardingModal from './OnboardingModal';
import { useOnboardingStore } from '@/stores/onboardingStore';

vi.mock('@/stores/onboardingStore', () => ({
  useOnboardingStore: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('OnboardingModal', () => {
  const mockSetCurrentStep = vi.fn();
  const mockCompleteOnboarding = vi.fn();
  const mockDismissOnboarding = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useOnboardingStore as any).mockReturnValue({
      currentStep: 0,
      setCurrentStep: mockSetCurrentStep,
      completeOnboarding: mockCompleteOnboarding,
      dismissOnboarding: mockDismissOnboarding,
    });
  });

  const renderModal = (isOpen = true) => render(
    <BrowserRouter>
      <OnboardingModal isOpen={isOpen} onClose={mockOnClose} />
    </BrowserRouter>
  );

  it('renders the new onboarding overview', () => {
    renderModal(true);

    expect(screen.getByText(/education-first workflow/i)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('advances to the next step', () => {
    renderModal(true);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
  });

  it('navigates to method settings from the method step action', () => {
    (useOnboardingStore as any).mockReturnValue({
      currentStep: 1,
      setCurrentStep: mockSetCurrentStep,
      completeOnboarding: mockCompleteOnboarding,
      dismissOnboarding: mockDismissOnboarding,
    });

    renderModal(true);

    fireEvent.click(screen.getByRole('button', { name: /open method settings/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/learn/settings');
  });

  it('dismisses on escape', async () => {
    renderModal(true);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(mockDismissOnboarding).toHaveBeenCalled();
    });
  });
});
