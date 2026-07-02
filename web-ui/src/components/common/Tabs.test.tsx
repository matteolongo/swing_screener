import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react';
import Tabs from './Tabs';

const tabs = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta', badge: 3 },
];

describe('Tabs', () => {
  it('renders tabs with aria-selected on the active one', () => {
    render(<Tabs tabs={tabs} active="a" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /Alpha/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Beta/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the clicked tab id', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} active="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /Beta/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('renders the badge count', () => {
    render(<Tabs tabs={tabs} active="a" onChange={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
