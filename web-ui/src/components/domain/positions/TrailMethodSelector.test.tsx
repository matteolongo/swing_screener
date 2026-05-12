import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrailMethodSelector from '@/components/domain/positions/TrailMethodSelector';
import { t } from '@/i18n/t';

describe('TrailMethodSelector', () => {
  it('renders all four trail method options', () => {
    render(<TrailMethodSelector value="sma20" param={null} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: t('positions.trailMethod.sma20') })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: t('positions.trailMethod.atr') })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: t('positions.trailMethod.fixedPct') })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: t('positions.trailMethod.manual') })).toBeInTheDocument();
  });

  it('shows param input for atr with default multiplier', () => {
    render(<TrailMethodSelector value="atr" param={2.0} onChange={vi.fn()} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('2');
  });

  it('shows param input for fixed_pct', () => {
    render(<TrailMethodSelector value="fixed_pct" param={5.0} onChange={vi.fn()} />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('hides param input for sma20', () => {
    render(<TrailMethodSelector value="sma20" param={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('hides param input for manual and shows note', () => {
    render(<TrailMethodSelector value="manual" param={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText(t('positions.trailMethod.manualNote'))).toBeInTheDocument();
  });

  it('calls onChange with default atr param when method changes to atr', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TrailMethodSelector value="sma20" param={null} onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'atr');
    expect(onChange).toHaveBeenCalledWith('atr', 2.0);
  });

  it('calls onChange with default fixed_pct param when method changes to fixed_pct', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TrailMethodSelector value="sma20" param={null} onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'fixed_pct');
    expect(onChange).toHaveBeenCalledWith('fixed_pct', 5.0);
  });

  it('calls onChange with null param when method changes to manual', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TrailMethodSelector value="atr" param={2.0} onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox'), 'manual');
    expect(onChange).toHaveBeenCalledWith('manual', null);
  });
});
