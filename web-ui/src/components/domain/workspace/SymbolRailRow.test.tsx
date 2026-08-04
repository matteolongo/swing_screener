import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import SymbolRailRow from './SymbolRailRow';

describe('SymbolRailRow', () => {
  it('exposes symbol context and selects from click or Enter', async () => {
    const onSelect = vi.fn();
    const { user } = renderWithProviders(
      <SymbolRailRow
        ticker="AAPL"
        status="Ready"
        context="Breakout"
        selected
        onSelect={onSelect}
      />,
    );
    const button = screen.getByRole('button', { name: /AAPL.*Ready.*Breakout/i });

    expect(button).toHaveAttribute('aria-current', 'true');
    await user.click(button);
    button.focus();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenNthCalledWith(1, 'AAPL');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'AAPL');
  });
});
