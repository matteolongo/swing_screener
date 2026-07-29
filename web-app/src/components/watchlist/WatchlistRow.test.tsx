import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WatchlistRow from './WatchlistRow';
import type { WatchlistItem } from '../../types/api';

const baseItem: WatchlistItem = {
  symbol: 'AAPL',
  exchange_mic: 'XNAS',
  price: 182.35,
  change_pct: 1.25,
  setup: 'Breakout',
  rr: 2.5,
  sector: 'Tech',
  held: 10,
};

function renderRow(item: WatchlistItem, opts?: { onAnalyze?: (s: string) => void; onRemove?: (s: string) => void; onRunScreener?: (s: string) => void }) {
  return render(
    <table>
      <tbody>
        <WatchlistRow
          item={item}
          onAnalyze={opts?.onAnalyze}
          onRemove={opts?.onRemove}
          onRunScreener={opts?.onRunScreener}
        />
      </tbody>
    </table>,
  );
}

describe('WatchlistRow', () => {
  it('renders all columns', () => {
    renderRow(baseItem);
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('XNAS')).toBeInTheDocument();
    expect(screen.getByText('182.35')).toBeInTheDocument();
    expect(screen.getByText('+1.25%')).toBeInTheDocument();
    expect(screen.getByText('Breakout')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
  });

  it('shows blue dot when held > 0', () => {
    renderRow(baseItem);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('does not render setup tag when undefined', () => {
    renderRow({ ...baseItem, setup: undefined });
    expect(screen.queryByText('Breakout')).not.toBeInTheDocument();
  });

  it('does not render R:R when undefined', () => {
    renderRow({ ...baseItem, rr: undefined });
    expect(screen.queryByText('2.50')).not.toBeInTheDocument();
  });

  it('colors positive change green', () => {
    renderRow({ ...baseItem, change_pct: 2.5 });
    const el = screen.getByText('+2.50%');
    expect(el.className).toContain('text-success');
  });

  it('colors negative change red', () => {
    renderRow({ ...baseItem, change_pct: -1.5 });
    const el = screen.getByText('-1.50%');
    expect(el.className).toContain('text-danger');
  });

  it('opens action dropdown on button click', () => {
    renderRow(baseItem);
    const btns = screen.getAllByRole('button');
    fireEvent.click(btns[0]);
    expect(screen.getByText('Run Screener')).toBeInTheDocument();
    expect(screen.getByText('Analyze')).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('calls onAnalyze from dropdown', () => {
    const onAnalyze = vi.fn();
    renderRow(baseItem, { onAnalyze });
    const btns = screen.getAllByRole('button');
    fireEvent.click(btns[0]);
    fireEvent.click(screen.getByText('Analyze'));
    expect(onAnalyze).toHaveBeenCalledWith('AAPL');
  });

  it('calls onRemove from dropdown', () => {
    const onRemove = vi.fn();
    renderRow(baseItem, { onRemove });
    const btns = screen.getAllByRole('button');
    fireEvent.click(btns[0]);
    fireEvent.click(screen.getByText('Remove'));
    expect(onRemove).toHaveBeenCalledWith('AAPL');
  });

  it('calls onRunScreener from dropdown', () => {
    const onRunScreener = vi.fn();
    renderRow(baseItem, { onRunScreener });
    const btns = screen.getAllByRole('button');
    fireEvent.click(btns[0]);
    fireEvent.click(screen.getByText('Run Screener'));
    expect(onRunScreener).toHaveBeenCalledWith('AAPL');
  });

  it('shows context menu on right-click', () => {
    renderRow(baseItem);
    const row = screen.getByText('AAPL').closest('tr')!;
    fireEvent.contextMenu(row, { clientX: 100, clientY: 100 });
    expect(screen.getByText('Run Screener')).toBeInTheDocument();
  });

  it('colors R:R green when >= 2.0', () => {
    renderRow({ ...baseItem, rr: 2.5 });
    const el = screen.getByText('2.50');
    expect(el.className).toContain('text-success');
  });

  it('colors R:R amber when >= 1.5 and < 2.0', () => {
    renderRow({ ...baseItem, rr: 1.8 });
    const el = screen.getByText('1.80');
    expect(el.className).toContain('text-warning');
  });

  it('colors R:R red when < 1.5', () => {
    renderRow({ ...baseItem, rr: 1.2 });
    const el = screen.getByText('1.20');
    expect(el.className).toContain('text-danger');
  });
});
