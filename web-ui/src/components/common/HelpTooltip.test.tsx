import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import HelpTooltip from './HelpTooltip';

describe('HelpTooltip', () => {
  it('restores focus to the trigger after Escape closes the help dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <HelpTooltip short="Help" title="Details" content={<p>Body</p>} />,
    );

    const trigger = screen.getByRole('button', { name: 'Help' });
    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Details' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Details' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
