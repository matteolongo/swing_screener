import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import OnboardingModal from './OnboardingModal';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';

// Mock the store
vi.mock('@/stores/userPreferencesStore', () => ({
  useUserPreferencesStore: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('OnboardingModal', () => {
  const mockSetOnboardingStep = vi.fn();
  const mockCompleteOnboarding = vi.fn();
  const mockDismissOnboarding = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useUserPreferencesStore as any).mockReturnValue({
      onboardingStep: 0,
      setOnboardingStep: mockSetOnboardingStep,
      completeOnboarding: mockCompleteOnboarding,
      dismissOnboarding: mockDismissOnboarding,
    });
  });

  const renderModal = (isOpen = true) => {
    return render(
      <BrowserRouter>
        <OnboardingModal isOpen={isOpen} onClose={mockOnClose} />
      </BrowserRouter>
    );
  };

  it('should not render when isOpen is false', () => {
    renderModal(false);
    
    expect(screen.queryByText(/Welcome to Swing Screener/i)).not.toBeInTheDocument();
  });

  it('should render first step when opened', () => {
    renderModal(true);
    
    expect(screen.getByText(/Welcome to Swing Screener/i)).toBeInTheDocument();
    // Check for key text from the first step
    expect(screen.getByText(/This quick guide will walk you through your daily workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/Configure/i)).toBeInTheDocument();
    expect(screen.getByText(/your strategy and risk parameters/i)).toBeInTheDocument();
  });

  it('should show progress indicator', () => {
    renderModal(true);
    
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('should advance to next step when Next is clicked', () => {
    renderModal(true);
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);
    
    expect(mockSetOnboardingStep).toHaveBeenCalledWith(1);
  });

  it('should go back to previous step when Back is clicked', () => {
    (useUserPreferencesStore as any).mockReturnValue({
      onboardingStep: 2,
      setOnboardingStep: mockSetOnboardingStep,
      completeOnboarding: mockCompleteOnboarding,
      dismissOnboarding: mockDismissOnboarding,
    });
    
    renderModal(true);
    
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);
    
    expect(mockSetOnboardingStep).toHaveBeenCalledWith(1);
  });

  it('should not show Back button on first step', () => {
    renderModal(true);
    
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('should complete onboarding on last step', () => {
    (useUserPreferencesStore as any).mockReturnValue({
      onboardingStep: 4,
      setOnboardingStep: mockSetOnboardingStep,
      completeOnboarding: mockCompleteOnboarding,
      dismissOnboarding: mockDismissOnboarding,
    });
    
    renderModal(true);
    
    const completeButton = screen.getByRole('button', { name: /complete/i });
    fireEvent.click(completeButton);
    
    expect(mockCompleteOnboarding).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should dismiss onboarding when close button is clicked', () => {
    renderModal(true);
    
    const closeButton = screen.getByRole('button', { name: /close onboarding/i });
    fireEvent.click(closeButton);
    
    expect(mockDismissOnboarding).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should navigate to Strategy page when action button is clicked on step 2', () => {
    (useUserPreferencesStore as any).mockReturnValue({
      onboardingStep: 1,
      setOnboardingStep: mockSetOnboardingStep,
      completeOnboarding: mockCompleteOnboarding,
      dismissOnboarding: mockDismissOnboarding,
    });
    
    renderModal(true);
    
    const actionButton = screen.getByRole('button', { name: /go to strategy/i });
    fireEvent.click(actionButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/strategy');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should dismiss on Escape key', async () => {
    renderModal(true);
    
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    
    await waitFor(() => {
      expect(mockDismissOnboarding).toHaveBeenCalled();
    });
  });

  it('should show all 5 steps in progress indicator', () => {
    renderModal(true);
    
    const progressBars = screen.getByText('Step 1 of 5').parentElement?.querySelectorAll('div[class*="h-2"]');
    expect(progressBars?.length).toBe(5);
  });
});
