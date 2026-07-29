import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsDrawer from './SettingsDrawer';
import { useAppStore } from '../../store/useAppStore';
import { useSettingsStore } from '../../store/useSettingsStore';

beforeEach(() => {
  vi.useFakeTimers();
  useAppStore.setState({ drawerOpen: false, accountSize: 50000 });
  useSettingsStore.setState({ intradayNewsWindow: 4, alertToggles: {}, soundEnabled: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SettingsDrawer', () => {
  it('does not render when closed', () => {
    const { container } = render(<SettingsDrawer />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when open', () => {
    useAppStore.setState({ drawerOpen: true });
    render(<SettingsDrawer />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('closes on X button click', () => {
    useAppStore.setState({ drawerOpen: true });
    render(<SettingsDrawer />);
    const closeBtn = document.querySelector('button svg');
    if (closeBtn) fireEvent.click(closeBtn.closest('button')!);
    vi.advanceTimersByTime(350);
    expect(useAppStore.getState().drawerOpen).toBe(false);
  });

  it('displays account size and saves', () => {
    useAppStore.setState({ drawerOpen: true });
    render(<SettingsDrawer />);
    const input = screen.getByDisplayValue('50000') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '75000' } });
    fireEvent.click(screen.getByText('Save'));
    expect(useAppStore.getState().accountSize).toBe(75000);
  });

  it('displays intraday news window', () => {
    useAppStore.setState({ drawerOpen: true });
    render(<SettingsDrawer />);
    const input = screen.getByDisplayValue('4');
    expect(input).toBeInTheDocument();
  });

  it('updates intraday news window on change', () => {
    useAppStore.setState({ drawerOpen: true });
    render(<SettingsDrawer />);
    const input = screen.getByDisplayValue('4') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8' } });
    expect(useSettingsStore.getState().intradayNewsWindow).toBe(8);
  });

  it('toggles alert switches', () => {
    useAppStore.setState({ drawerOpen: true });
    render(<SettingsDrawer />);
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    expect(useSettingsStore.getState().alertToggles['exhaustion']).toBe(false);
  });

  it('toggles sound on/off', () => {
    useAppStore.setState({ drawerOpen: true });
    render(<SettingsDrawer />);
    const soundSwitch = screen.getAllByRole('switch');
    fireEvent.click(soundSwitch[soundSwitch.length - 1]);
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
  });
});
