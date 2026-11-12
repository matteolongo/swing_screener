import { describe, expect, it } from 'vitest';
import { OpenPositionItem } from './TodayActionItems';
import { renderWithProviders, screen } from '@/test/utils';
describe('row actions', () => {
  it('renders selection and trim as sibling native buttons in a semantic group', () => {
    renderWithProviders(
      <OpenPositionItem
        item={{ ticker: 'LRCX', positionId: 'POS-1', rNow: 2.1, daysOpen: 4, pnlPercent: 8 } as never}
        trimSuggestion={{ rThreshold: 2, rNow: 2.1 }}
        onClick={() => {}}
        onTrim={() => {}}
      />,
    );

    const group = screen.getByRole('group', { name: 'LRCX' });
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(group.querySelector('button button')).toBeNull();
  });
});
