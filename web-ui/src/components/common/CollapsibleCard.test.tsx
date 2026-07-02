import { render, screen, fireEvent } from '@testing-library/react';
import CollapsibleCard from './CollapsibleCard';

describe('CollapsibleCard', () => {
  beforeEach(() => localStorage.clear());

  it('renders title, summary and content when open', () => {
    render(
      <CollapsibleCard id="x" title="Positions" summary={<span>2</span>}>
        <div>body</div>
      </CollapsibleCard>
    );
    expect(screen.getByText('Positions')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('collapses on header click, keeps summary visible, persists state', () => {
    render(
      <CollapsibleCard id="x" title="Positions" summary={<span>2</span>}>
        <div>body</div>
      </CollapsibleCard>
    );
    fireEvent.click(screen.getByRole('button', { expanded: true }));
    expect(screen.queryByText('body')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(localStorage.getItem('card.x.open')).toBe('false');
  });

  it('restores persisted collapsed state', () => {
    localStorage.setItem('card.x.open', 'false');
    render(
      <CollapsibleCard id="x" title="Positions">
        <div>body</div>
      </CollapsibleCard>
    );
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });
});
