import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionMenu from './ActionMenu';
import { renderWithProviders } from '@/test/utils';
import { t } from '@/i18n/t';

const label = `${t('workspacePage.panels.portfolio.columns.actions')} TEST`;

describe('ActionMenu', () => {
  it('opens outside its container and activates a native action with Space', async () => {
    const onAction = vi.fn();
    const { container } = renderWithProviders(<ActionMenu label={label} items={[
      { label: t('common.actions.save'), onClick: onAction },
    ]} />);
    const trigger = screen.getByRole('button', { name: label });
    trigger.focus();
    await userEvent.keyboard(' ');
    const popup = screen.getByRole('group', { name: label });
    expect(container).not.toContainElement(popup);
    expect(trigger).toHaveAttribute('aria-controls', popup.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('common.actions.save') })).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole('group', { name: label })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('dismisses on Escape and outside pointer presses with focus return', async () => {
    renderWithProviders(<ActionMenu label={label} items={[
      { label: t('common.actions.save'), onClick: () => {} },
    ]} />);
    const trigger = screen.getByRole('button', { name: label });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('group', { name: label })).not.toBeInTheDocument();
  });

  it('closes when the expanded trigger is pressed again', async () => {
    renderWithProviders(<ActionMenu label={label} items={[
      { label: t('common.actions.save'), onClick: () => {} },
    ]} />);
    const trigger = screen.getByRole('button', { name: label });
    await userEvent.click(trigger);
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: label })).not.toBeInTheDocument();
  });

  it('keeps normal Tab navigation and dismisses when focus leaves', async () => {
    renderWithProviders(<>
      <ActionMenu label={label} items={[
        { label: t('common.actions.save'), onClick: () => {} },
        { label: t('common.actions.cancel'), onClick: () => {} },
      ]} />
      <button type="button">{t('common.actions.back')}</button>
    </>);
    await userEvent.click(screen.getByRole('button', { name: label }));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: t('common.actions.cancel') })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: t('common.actions.save') })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: t('common.actions.back') })).toHaveFocus();
    expect(screen.queryByRole('group', { name: label })).not.toBeInTheDocument();
  });

  it('dismisses when reverse Tab leaves the popup through its trigger without restoring focus', async () => {
    renderWithProviders(<>
      <button type="button">{t('common.actions.back')}</button>
      <ActionMenu label={label} items={[
        { label: t('common.actions.save'), onClick: () => {} },
      ]} />
    </>);
    const trigger = screen.getByRole('button', { name: label });
    const preceding = screen.getByRole('button', { name: t('common.actions.back') });
    await userEvent.click(trigger);
    await userEvent.tab({ shift: true });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.tab({ shift: true });
    expect(preceding).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: label })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(preceding).toHaveFocus();
  });

  it.each(['scroll', 'resize'])('dismisses on viewport %s and removes the portal on unmount', async (event) => {
    const { unmount } = renderWithProviders(<ActionMenu label={label} items={[
      { label: t('common.actions.save'), onClick: () => {} },
    ]} />);
    const trigger = screen.getByRole('button', { name: label });
    await userEvent.click(trigger);
    fireEvent.scroll(screen.getByRole('group', { name: label }));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent(window, new Event(event));
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    unmount();
    expect(screen.queryByRole('group', { name: label })).not.toBeInTheDocument();
    fireEvent(window, new Event(event));
  });
});
