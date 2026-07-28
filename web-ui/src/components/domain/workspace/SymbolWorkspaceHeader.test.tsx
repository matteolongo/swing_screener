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
    const onRefreshAll = vi.fn();
    const { user } = renderWithProviders(
      <SymbolWorkspaceHeader
        ticker="AAPL"
        fullscreen={false}
        companyName="Apple Inc."
        mode="candidate"
        runAsOf="2026-07-28"
        runFreshness="final_close"
        health="partial"
        onRefreshAll={onRefreshAll}
        onClose={onClose}
        onCollapse={onCollapse}
        onFullscreenChange={onFullscreenChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: t('workspacePage.controls.close') }));
    await user.click(screen.getByRole('button', { name: t('workspacePage.controls.collapse') }));
    await user.click(screen.getByRole('button', { name: t('workspacePage.controls.fullscreen') }));
    await user.click(screen.getByRole('button', { name: t('workspacePage.controls.backToList') }));
    await user.click(screen.getByRole('button', { name: t('workspacePage.controls.refreshAll') }));

    expect(screen.getByRole('heading')).toHaveTextContent('AAPL · Apple Inc.');
    expect(screen.getByText(t('workspacePage.header.candidateMode'))).toBeVisible();
    expect(screen.getByText(t('workspacePage.panels.screener.freshness.finalClose'))).toBeVisible();
    expect(onRefreshAll).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onCollapse).toHaveBeenCalledTimes(2);
    expect(onFullscreenChange).toHaveBeenCalledWith(true);
  });
});
