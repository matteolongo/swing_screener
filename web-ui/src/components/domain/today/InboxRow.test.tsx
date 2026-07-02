import { describe, expect, it, vi } from 'vitest';
import InboxRow from './InboxRow';
import { renderWithProviders, screen } from '@/test/utils';
import { messagesEn } from '@/i18n/messages.en';
import type { InboxItem } from '@/features/dailyReview/inbox';

function makeItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: 'close:AAPL',
    kind: 'close',
    ticker: 'AAPL',
    reason: 'AAPL closed below stop.',
    ...overrides,
  };
}

describe('InboxRow', () => {
  it('renders the close kind badge label from i18n', () => {
    renderWithProviders(
      <InboxRow item={makeItem()} onSelectTicker={vi.fn()} onAction={vi.fn()} />,
    );
    expect(
      screen.getByText(messagesEn.todayPage.inbox.kinds.close, { selector: 'span:not([role="button"])' }),
    ).toBeInTheDocument();
  });

  it('renders the updateStop kind badge label from i18n', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ id: 'updateStop:MSFT', kind: 'updateStop', ticker: 'MSFT' })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(
      screen.getByText(messagesEn.todayPage.inbox.kinds.updateStop, { selector: 'span:not([role="button"])' }),
    ).toBeInTheDocument();
  });

  it('renders the watch kind badge label from i18n', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ id: 'watch:ASML', kind: 'watch', ticker: 'ASML', distanceToTriggerPct: -1.3 })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(messagesEn.todayPage.inbox.kinds.watch)).toBeInTheDocument();
  });

  it('renders the weeklyReview kind badge label from i18n and no ticker button', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ id: 'weeklyReview:weekly', kind: 'weeklyReview', ticker: null, reason: '' })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(messagesEn.todayPage.inbox.kinds.weeklyReview)).toBeInTheDocument();
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });

  it('dot tone is down for close', () => {
    renderWithProviders(
      <InboxRow item={makeItem()} onSelectTicker={vi.fn()} onAction={vi.fn()} />,
    );
    expect(screen.getByRole('status')).toHaveClass('bg-danger');
  });

  it('dot tone is warn for updateStop/exitSignal/staleOrder', () => {
    const { unmount } = renderWithProviders(
      <InboxRow
        item={makeItem({ id: 'updateStop:MSFT', kind: 'updateStop', ticker: 'MSFT' })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveClass('bg-warning');
    unmount();

    renderWithProviders(
      <InboxRow
        item={makeItem({ id: 'staleOrder:ord-1', kind: 'staleOrder', ticker: 'TSLA' })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveClass('bg-warning');
  });

  it('dot tone is idle for addOn/newCandidate/watch/weeklyReview', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ id: 'addOn:AMD', kind: 'addOn', ticker: 'AMD' })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveClass('bg-muted/50');
  });

  it('calls onSelectTicker with the ticker when the ticker button is clicked', async () => {
    const onSelectTicker = vi.fn();
    const { user } = renderWithProviders(
      <InboxRow item={makeItem()} onSelectTicker={onSelectTicker} onAction={vi.fn()} />,
    );
    await user.click(screen.getByText('AAPL'));
    expect(onSelectTicker).toHaveBeenCalledWith('AAPL');
  });

  it('close kind renders a close action button that calls onAction("close", item)', async () => {
    const onAction = vi.fn();
    const item = makeItem();
    const { user } = renderWithProviders(
      <InboxRow item={item} onSelectTicker={vi.fn()} onAction={onAction} />,
    );
    await user.click(screen.getByRole('button', { name: messagesEn.todayPage.inbox.actions.close }));
    expect(onAction).toHaveBeenCalledWith('close', item);
  });

  it('updateStop kind renders applyStop primary and updateStop secondary actions', async () => {
    const onAction = vi.fn();
    const item = makeItem({ id: 'updateStop:MSFT', kind: 'updateStop', ticker: 'MSFT' });
    const { user } = renderWithProviders(
      <InboxRow item={item} onSelectTicker={vi.fn()} onAction={onAction} />,
    );
    await user.click(screen.getByRole('button', { name: messagesEn.todayPage.inbox.actions.applyStop }));
    expect(onAction).toHaveBeenCalledWith('applyStop', item);
    await user.click(screen.getByRole('button', { name: messagesEn.todayPage.inbox.actions.updateStop }));
    expect(onAction).toHaveBeenCalledWith('updateStop', item);
  });

  it('staleOrder kind renders a cancelOrder action', async () => {
    const onAction = vi.fn();
    const item = makeItem({ id: 'staleOrder:ord-1', kind: 'staleOrder', ticker: 'TSLA' });
    const { user } = renderWithProviders(
      <InboxRow item={item} onSelectTicker={vi.fn()} onAction={onAction} />,
    );
    await user.click(screen.getByText(messagesEn.todayPage.inbox.actions.cancelOrder));
    expect(onAction).toHaveBeenCalledWith('cancelOrder', item);
  });

  it('addOn and newCandidate kinds render a planOrder action', async () => {
    const onAction = vi.fn();
    const item = makeItem({ id: 'addOn:AMD', kind: 'addOn', ticker: 'AMD' });
    const { user } = renderWithProviders(
      <InboxRow item={item} onSelectTicker={vi.fn()} onAction={onAction} />,
    );
    await user.click(screen.getByText(messagesEn.todayPage.inbox.actions.planOrder));
    expect(onAction).toHaveBeenCalledWith('planOrder', item);
  });

  it('watch kind renders an analyze action', async () => {
    const onAction = vi.fn();
    const item = makeItem({ id: 'watch:ASML', kind: 'watch', ticker: 'ASML' });
    const { user } = renderWithProviders(
      <InboxRow item={item} onSelectTicker={vi.fn()} onAction={onAction} />,
    );
    await user.click(screen.getByText(messagesEn.todayPage.inbox.actions.analyze));
    expect(onAction).toHaveBeenCalledWith('analyze', item);
  });

  it('weeklyReview kind renders a goToReview action', async () => {
    const onAction = vi.fn();
    const item = makeItem({ id: 'weeklyReview:weekly', kind: 'weeklyReview', ticker: null, reason: '' });
    const { user } = renderWithProviders(
      <InboxRow item={item} onSelectTicker={vi.fn()} onAction={onAction} />,
    );
    await user.click(screen.getByText(messagesEn.todayPage.inbox.actions.goToReview));
    expect(onAction).toHaveBeenCalledWith('goToReview', item);
  });

  it('exitSignal kind renders no inline action buttons', () => {
    const item = makeItem({ id: 'exitSignal:NVDA', kind: 'exitSignal', ticker: 'NVDA' });
    renderWithProviders(
      <InboxRow item={item} onSelectTicker={vi.fn()} onAction={vi.fn()} />,
    );
    expect(screen.queryByText(messagesEn.todayPage.inbox.actions.close)).not.toBeInTheDocument();
    expect(screen.queryByText(messagesEn.todayPage.inbox.actions.analyze)).not.toBeInTheDocument();
  });

  it('exitSignal row click calls onAction("analyze", item) without hitting the ticker button', async () => {
    const onAction = vi.fn();
    const onSelectTicker = vi.fn();
    const item = makeItem({ id: 'exitSignal:NVDA', kind: 'exitSignal', ticker: 'NVDA', reason: 'NVDA below SMA20.' });
    const { user, container } = renderWithProviders(
      <InboxRow item={item} onSelectTicker={onSelectTicker} onAction={onAction} />,
    );
    const row = container.querySelector('[data-testid="inbox-row"]') as HTMLElement;
    await user.click(row);
    expect(onAction).toHaveBeenCalledWith('analyze', item);
    expect(onSelectTicker).not.toHaveBeenCalled();
  });

  it('renders RChip when rNow is present', () => {
    renderWithProviders(
      <InboxRow item={makeItem({ rNow: 1.5 })} onSelectTicker={vi.fn()} onAction={vi.fn()} />,
    );
    expect(screen.getByText('+1.50R')).toBeInTheDocument();
  });

  it('does not render RChip when rNow is absent', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ id: 'addOn:AMD', kind: 'addOn', ticker: 'AMD', rNow: undefined })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.queryByText(/R$/)).not.toBeInTheDocument();
  });

  it('expansion shows detail when expanded is true', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ detail: 'Extended explanation of the close reason.' })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
        expanded
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.getByText('Extended explanation of the close reason.')).toBeInTheDocument();
  });

  it('does not show detail when expanded is false', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ detail: 'Extended explanation of the close reason.' })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
        expanded={false}
        onToggleExpand={vi.fn()}
      />,
    );
    expect(screen.queryByText('Extended explanation of the close reason.')).not.toBeInTheDocument();
  });

  it('toggling the chevron calls onToggleExpand', async () => {
    const onToggleExpand = vi.fn();
    const { user } = renderWithProviders(
      <InboxRow
        item={makeItem()}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
        expanded={false}
        onToggleExpand={onToggleExpand}
      />,
    );
    await user.click(screen.getByLabelText(messagesEn.todayPage.inbox.why));
    expect(onToggleExpand).toHaveBeenCalled();
  });

  it('renders the suggested stop inline (mono stopCurrent -> stopSuggested) on updateStop rows without expanding', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ id: 'updateStop:MSFT', kind: 'updateStop', ticker: 'MSFT', stopCurrent: 380, stopSuggested: 395 })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText('380.00 → 395.00')).toBeInTheDocument();
  });

  it('does not render the inline suggested stop when stopCurrent/stopSuggested are absent', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ id: 'updateStop:MSFT', kind: 'updateStop', ticker: 'MSFT' })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('renders an AiSignalBadge on close rows carrying a positionSignal', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({ positionSignal: 'EXIT' })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(messagesEn.badges.positionSignal.exit)).toBeInTheDocument();
  });

  it('renders no AiSignalBadge on close rows without a positionSignal', () => {
    renderWithProviders(
      <InboxRow item={makeItem()} onSelectTicker={vi.fn()} onAction={vi.fn()} />,
    );
    expect(screen.queryByText(messagesEn.badges.positionSignal.exit)).not.toBeInTheDocument();
  });

  it('renders an ExhaustionBadge on updateStop rows carrying an exhaustionLabel', () => {
    renderWithProviders(
      <InboxRow
        item={makeItem({
          id: 'updateStop:MSFT',
          kind: 'updateStop',
          ticker: 'MSFT',
          exhaustionLabel: 'watch',
          exhaustionScore: 6.5,
        })}
        onSelectTicker={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(messagesEn.badges.exhaustion.watch, { exact: false })).toBeInTheDocument();
  });

  it('disables the applyStop action when it is in disabledActions', async () => {
    const onAction = vi.fn();
    const item = makeItem({
      id: 'updateStop:MSFT',
      kind: 'updateStop',
      ticker: 'MSFT',
      stopSuggested: 395,
    });
    const { user } = renderWithProviders(
      <InboxRow
        item={item}
        onSelectTicker={vi.fn()}
        onAction={onAction}
        disabledActions={['applyStop']}
      />,
    );
    const applyStopButton = screen.getByRole('button', { name: messagesEn.todayPage.inbox.actions.applyStop });
    expect(applyStopButton).toHaveAttribute('aria-disabled', 'true');
    await user.click(applyStopButton);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('leaves updateStop enabled when applyStop is not in disabledActions', async () => {
    const onAction = vi.fn();
    const item = makeItem({ id: 'updateStop:MSFT', kind: 'updateStop', ticker: 'MSFT', stopSuggested: 395 });
    const { user } = renderWithProviders(
      <InboxRow item={item} onSelectTicker={vi.fn()} onAction={onAction} disabledActions={['applyStop']} />,
    );
    await user.click(screen.getByRole('button', { name: messagesEn.todayPage.inbox.actions.updateStop }));
    expect(onAction).toHaveBeenCalledWith('updateStop', item);
  });

  it('renders the row dimmed and struck when done is true', () => {
    const { container } = renderWithProviders(
      <InboxRow item={makeItem()} onSelectTicker={vi.fn()} onAction={vi.fn()} done />,
    );
    const row = container.querySelector('[data-testid="inbox-row"]');
    expect(row).toHaveClass('opacity-50');
    expect(row).toHaveClass('line-through');
  });

  it('does not dim the row when done is false', () => {
    const { container } = renderWithProviders(
      <InboxRow item={makeItem()} onSelectTicker={vi.fn()} onAction={vi.fn()} done={false} />,
    );
    const row = container.querySelector('[data-testid="inbox-row"]');
    expect(row).not.toHaveClass('opacity-50');
  });

  describe('moreCandidates kind', () => {
    function makeMoreCandidatesItem(overrides: Partial<InboxItem> = {}): InboxItem {
      return makeItem({
        id: 'moreCandidates',
        kind: 'moreCandidates',
        ticker: null,
        reason: '',
        count: 90,
        ...overrides,
      });
    }

    it('renders the moreCandidates kind badge label from i18n', () => {
      renderWithProviders(
        <InboxRow item={makeMoreCandidatesItem()} onSelectTicker={vi.fn()} onAction={vi.fn()} />,
      );
      expect(screen.getByText(messagesEn.todayPage.inbox.kinds.moreCandidates)).toBeInTheDocument();
    });

    it('renders the interpolated "view N more candidates" label from i18n', () => {
      renderWithProviders(
        <InboxRow item={makeMoreCandidatesItem({ count: 90 })} onSelectTicker={vi.fn()} onAction={vi.fn()} />,
      );
      expect(
        screen.getByText(messagesEn.todayPage.inbox.moreCandidatesLabel.replace('{{count}}', '90')),
      ).toBeInTheDocument();
    });

    it('dot tone is idle (neutral) for moreCandidates', () => {
      renderWithProviders(
        <InboxRow item={makeMoreCandidatesItem()} onSelectTicker={vi.fn()} onAction={vi.fn()} />,
      );
      expect(screen.getByRole('status')).toHaveClass('bg-muted/50');
    });

    it('renders a goToScreener action that calls onAction("goToScreener", item)', async () => {
      const onAction = vi.fn();
      const item = makeMoreCandidatesItem();
      const { user } = renderWithProviders(
        <InboxRow item={item} onSelectTicker={vi.fn()} onAction={onAction} />,
      );
      await user.click(screen.getByText(messagesEn.todayPage.inbox.actions.goToScreener));
      expect(onAction).toHaveBeenCalledWith('goToScreener', item);
    });

    it('renders no ticker button since ticker is null', () => {
      renderWithProviders(
        <InboxRow item={makeMoreCandidatesItem()} onSelectTicker={vi.fn()} onAction={vi.fn()} />,
      );
      expect(screen.queryByText('null')).not.toBeInTheDocument();
    });

    it('renders no expand/why affordance even when onToggleExpand is provided', () => {
      renderWithProviders(
        <InboxRow
          item={makeMoreCandidatesItem()}
          onSelectTicker={vi.fn()}
          onAction={vi.fn()}
          onToggleExpand={vi.fn()}
        />,
      );
      expect(screen.queryByLabelText(messagesEn.todayPage.inbox.why)).not.toBeInTheDocument();
    });
  });
});
