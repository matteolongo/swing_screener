import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { messagesEn } from '@/i18n/messages.en';
import QuickFilterBar from './QuickFilterBar';

const tx = messagesEn.screener.taxonomy;

describe('QuickFilterBar', () => {
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
