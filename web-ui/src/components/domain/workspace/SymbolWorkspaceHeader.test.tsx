import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import SymbolWorkspaceHeader from './SymbolWorkspaceHeader';

describe('SymbolWorkspaceHeader', () => {
  it('exposes close, collapse, fullscreen, and mobile back controls', async () => {
    const onClose = vi.fn();
    const onCollapse = vi.fn();
    const onFullscreenChange = vi.fn();
    const { user } = renderWithProviders(
      <SymbolWorkspaceHeader
        ticker="AAPL"
        fullscreen={false}
        onClose={onClose}
        onCollapse={onCollapse}
        onFullscreenChange={onFullscreenChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: t('workspacePage.controls.close') }));
    await user.click(screen.getByRole('button', { name: t('workspacePage.controls.collapse') }));
    await user.click(screen.getByRole('button', { name: t('workspacePage.controls.fullscreen') }));
    await user.click(screen.getByRole('button', { name: t('workspacePage.controls.backToList') }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onCollapse).toHaveBeenCalledTimes(2);
    expect(onFullscreenChange).toHaveBeenCalledWith(true);
  });
});
