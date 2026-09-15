import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { useTodayActions } from './useTodayActions';

vi.mock('@/features/portfolio/hooks', () => ({
  useUpdateStopMutation: () => ({ mutate: vi.fn() }),
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
