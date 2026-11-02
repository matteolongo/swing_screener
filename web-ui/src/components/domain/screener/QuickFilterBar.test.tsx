import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { messagesEn } from '@/i18n/messages.en';
import QuickFilterBar from './QuickFilterBar';
import { t } from '@/i18n/t';

const tx = messagesEn.screener.taxonomy;

describe('QuickFilterBar', () => {
  it('names every index checkbox from its visible localized label and preserves its filter id', async () => {
    const onChange = vi.fn();
    renderWithProviders(<QuickFilterBar
      value={{}}
      onChange={onChange}
      presetId={null}
      onPresetChange={() => {}}
    />);
    const disclosure = screen.getByText(t('screener.taxonomy.index.placeholder')).closest('details')!;
    // happy-dom does not implement native details toggling; open the disclosure directly.
    disclosure.setAttribute('open', '');
    const indices = [
      'us_sp500', 'us_nasdaq100', 'us_dow30', 'germany_dax', 'france_cac40',
      'uk_ftse100', 'spain_ibex35', 'europe_eurostoxx50', 'amsterdam_aex',
      'italy_ftse_mib', 'broad_market_stocks',
    ] as const;
    expect(within(disclosure).getAllByRole('checkbox')).toHaveLength(indices.length);
    for (const id of indices) {
      const name = t(`screener.taxonomy.indexLabels.${id}`);
      const checkbox = within(disclosure).getByRole('checkbox', { name });
      expect(checkbox.closest('label')).toHaveTextContent(name);
    }
    within(disclosure).getByRole('checkbox', { name: t('screener.taxonomy.indexLabels.us_sp500') }).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith({ indexMemberships: ['us_sp500'] });
  });

  it('toggles a region chip and clears the active preset', () => {
    const onChange = vi.fn();
    const onPresetChange = vi.fn();
    renderWithProviders(
      <QuickFilterBar
        value={{}}
        onChange={onChange}
        presetId="us_large_cap_equities"
        onPresetChange={onPresetChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: tx.region.us }));
    expect(onChange).toHaveBeenCalledWith({ region: ['us'] });
    expect(onPresetChange).toHaveBeenCalledWith(null);
  });

  it('removes a region value when its chip is toggled off', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <QuickFilterBar
        value={{ region: ['us'] }}
        onChange={onChange}
        presetId={null}
        onPresetChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: tx.region.us }));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('maps the Type chip to the coarse instrumentType', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <QuickFilterBar
        value={{}}
        onChange={onChange}
        presetId={null}
        onPresetChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: tx.type.etf }));
    expect(onChange).toHaveBeenCalledWith({ instrumentType: ['etf'] });
  });
});
