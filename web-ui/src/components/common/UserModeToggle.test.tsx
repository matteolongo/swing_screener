import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserModeToggle from './UserModeToggle';
import { useUserPreferencesStore } from '@/stores/userPreferencesStore';

describe('UserModeToggle', () => {
  it('renders with beginner mode by default in production', () => {
    // Reset to beginner mode for this test
    useUserPreferencesStore.setState({ mode: 'beginner' });
    
    render(<UserModeToggle />);
    
    expect(screen.getByText('Beginner')).toBeInTheDocument();
  });

  it('renders with advanced mode when set', () => {
    // Set to advanced mode
    useUserPreferencesStore.setState({ mode: 'advanced' });
    
    render(<UserModeToggle />);
    
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('toggles between beginner and advanced modes', async () => {
    const user = userEvent.setup();
    useUserPreferencesStore.setState({ mode: 'beginner' });
    
    const { rerender } = render(<UserModeToggle />);
    
    // Initially beginner
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    
    // Click to toggle
    await user.click(screen.getByRole('button'));
    
    // Re-render to see the change
    rerender(<UserModeToggle />);
    
    // Now advanced
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    
    // Click again to toggle back
    await user.click(screen.getByRole('button'));
    rerender(<UserModeToggle />);
    
    // Back to beginner
    expect(screen.getByText('Beginner')).toBeInTheDocument();
  });

  it('persists mode to localStorage', async () => {
    const user = userEvent.setup();
    useUserPreferencesStore.setState({ mode: 'beginner' });
    
    render(<UserModeToggle />);
    
    // Toggle to advanced
    await user.click(screen.getByRole('button'));
    
    // Check localStorage
    const stored = localStorage.getItem('swing-screener-user-preferences');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.mode).toBe('advanced');
  });
});
