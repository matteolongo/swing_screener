import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderHook, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { useTodayActions } from './useTodayActions';
import type { Position } from '@/types/position';

const { mutateStop } = vi.hoisted(() => ({ mutateStop: vi.fn() }));

vi.mock('@/features/portfolio/hooks', () => ({
  useUpdateStopMutation: () => ({ mutate: mutateStop }),
  useClosePositionMutation: () => ({ mutate: vi.fn() }),
  usePartialClosePositionMutation: () => ({ mutate: vi.fn() }),
}));

const rows = [
  { id: 'close-1', ticker: 'DUP' },
  { id: 'pending-2', ticker: 'DUP' },
  { id: 'close-3', ticker: 'NEXT' },
];

function Harness() {
  const [items, setItems] = useState(rows);
  const [selected, setSelected] = useState('');
  const actions = useTodayActions(items, setSelected);
  return (
    <div>
      <div onKeyDown={actions.handleListKeyDown}>
        {items.map((item) => (
          <button key={item.id} onClick={() => actions.handleItemClick(item.ticker, item.id)}>
            {item.id}{actions.focusedId === item.id ? '*' : ''}
          </button>
        ))}
        <input aria-label="input" />
        <div contentEditable aria-label="editable" />
        <div role="textbox" tabIndex={0} aria-label="textbox" />
        <div role="dialog" tabIndex={0} aria-label="dialog" />
      </div>
      <output>{selected}</output>
      <button onClick={() => setItems([rows[2], rows[1]])}>change rows</button>
    </div>
  );
}

describe('useTodayActions keyboard navigation', () => {
  it('resolves open management targets by ID after a position refresh', () => {
    const original: Position = { ticker: 'TEST', positionId: 'POS-1', version: 1,
      status: 'open', entryDate: '2026-10-01', entryPrice: 100, stopPrice: 95, shares: 10 };
    const { result, rerender } = renderHook(({ positions }) => useTodayActions(rows, vi.fn(), positions), {
      initialProps: { positions: [original] },
    });
    act(() => result.current.setTrimTarget(original));
    rerender({ positions: [{ ...original, shares: 5, version: 2 }] });
    expect(result.current.trimTarget).toMatchObject({ shares: 5, version: 2 });
    rerender({ positions: [] });
    expect(result.current.trimTarget).toBeNull();
  });

  it('carries the current position version when accepting a suggested stop', () => {
    const original: Position = { ticker: 'TEST', positionId: 'POS-1', version: 7,
      status: 'open', entryDate: '2026-10-01', entryPrice: 100, stopPrice: 95, shares: 10 };
    const { result } = renderHook(() => useTodayActions(rows, vi.fn(), [original]));
    act(() => result.current.handleAcceptStop('POS-1', 97, 'manual review'));
    expect(mutateStop).toHaveBeenCalledWith({
      positionId: 'POS-1', request: { newStop: 97, reason: 'manual review', expectedVersion: 7 },
    }, expect.any(Object));
  });
  it('suspends shortcuts in editable controls and dialogs', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'close-1' }));

    for (const target of ['input', 'editable', 'textbox', 'dialog']) {
      fireEvent.keyDown(screen.getByLabelText(target), { key: 'j' });
      expect(screen.getByRole('button', { name: 'close-1*' })).toBeInTheDocument();
    }
  });

  it('tracks a duplicate-ticker row by stable ID through reorder and shrink', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'pending-2' }));
    await user.click(screen.getByRole('button', { name: 'change rows' }));

    fireEvent.keyDown(screen.getByRole('button', { name: 'pending-2*' }), { key: 'k' });

    expect(screen.getByRole('button', { name: 'close-3*' })).toBeInTheDocument();
    expect(screen.getByText('NEXT')).toBeInTheDocument();
  });
});
