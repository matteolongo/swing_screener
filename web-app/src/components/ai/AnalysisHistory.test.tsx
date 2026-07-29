import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalysisHistory from './AnalysisHistory';
import type { HistoryEntry } from '@/types/api';

const entries: HistoryEntry[] = [
  { generated_at: '2025-07-28T20:00:00Z', action: 'ENTER', conviction: 'high', summary_line: 'Strong momentum breakout', watch_for: 'volume confirmation' },
  { generated_at: '2025-07-27T20:00:00Z', action: 'WATCH', conviction: 'medium', summary_line: 'Consolidation forming above support', watch_for: 'break above 185' },
  { generated_at: '2025-07-26T20:00:00Z', action: 'AVOID', conviction: 'low', summary_line: 'Bearish divergence on RSI', watch_for: 'reversal confirmation' },
];

describe('AnalysisHistory', () => {
  it('renders entries sorted newest first', () => {
    render(<AnalysisHistory entries={entries} onSelect={vi.fn()} />);
    const summaries = screen.getAllByText(/Strong momentum|Consolidation|Bearish/);
    expect(summaries[0].textContent).toBe('Strong momentum breakout');
    expect(summaries[1].textContent).toBe('Consolidation forming above support');
    expect(summaries[2].textContent).toBe('Bearish divergence on RSI');
  });

  it('shows date badges', () => {
    render(<AnalysisHistory entries={entries} onSelect={vi.fn()} />);
    expect(screen.getByText('Jul 28')).toBeInTheDocument();
    expect(screen.getByText('Jul 27')).toBeInTheDocument();
    expect(screen.getByText('Jul 26')).toBeInTheDocument();
  });

  it('shows action tags with correct colors', () => {
    render(<AnalysisHistory entries={entries} onSelect={vi.fn()} />);
    expect(screen.getByText('ENTER')).toBeInTheDocument();
    expect(screen.getByText('WATCH')).toBeInTheDocument();
    expect(screen.getByText('AVOID')).toBeInTheDocument();
  });

  it('shows conviction badges', () => {
    render(<AnalysisHistory entries={entries} onSelect={vi.fn()} />);
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('expands entry on click to show full details', () => {
    render(<AnalysisHistory entries={entries} onSelect={vi.fn()} />);
    const summary = screen.getByText('Strong momentum breakout');
    fireEvent.click(summary.closest('button')!);
    expect(screen.getByText('volume confirmation')).toBeInTheDocument();
  });

  it('calls onSelect when entry header is clicked', () => {
    const onSelect = vi.fn();
    render(<AnalysisHistory entries={entries} onSelect={onSelect} />);
    const summary = screen.getByText('Strong momentum breakout');
    fireEvent.click(summary.closest('button')!);
    expect(onSelect).toHaveBeenCalledWith(entries[0]);
  });

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(<AnalysisHistory entries={[]} onSelect={vi.fn()} isLoading={true} />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders empty state when no entries', () => {
    render(<AnalysisHistory entries={[]} onSelect={vi.fn()} />);
    expect(screen.getByText('No analysis history yet')).toBeInTheDocument();
  });
});
