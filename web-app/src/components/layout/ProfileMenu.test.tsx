import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileMenu from './ProfileMenu';
import { useAppStore } from '../../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ drawerOpen: false });
});

describe('ProfileMenu', () => {
  it('renders gear icon', () => {
    render(<ProfileMenu />);
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('toggles drawer on click', () => {
    render(<ProfileMenu />);
    fireEvent.click(screen.getByTitle('Settings'));
    expect(useAppStore.getState().drawerOpen).toBe(true);
  });
});
