import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CandidateRow from './CandidateRow';
import type { CandidateRow as CandidateRowType } from '../../types/api';

const baseCandidate: CandidateRowType = {
  rank: 1,
  symbol: 'AAPL',
  exchange_mic: 'XNAS',
  setup: 'Breakout',
  entry: 180.5,
  stop: 170.2,
  rr: 2.5,
  risk_usd: 500,
  shares: 50,
  sector: 'Tech',
  price: 182.3,
  close: 181.0,
  catalyst: 'Earnings',
  gain: 3.5,
  held: 10,
};

function renderRow(candidate: CandidateRowType, isHeld?: boolean, onAnalyze?: () => void) {
  return render(
    <table>
      <tbody>
        <CandidateRow candidate={candidate} isHeld={isHeld} onAnalyze={onAnalyze} />
      </tbody>
    </table>,
  );
}

describe('CandidateRow', () => {
  it('renders all columns', () => {
    renderRow(baseCandidate);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('XNAS')).toBeInTheDocument();
    expect(screen.getByText('Breakout')).toBeInTheDocument();
    expect(screen.getByText('180.50')).toBeInTheDocument();
    expect(screen.getByText('170.20')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('$500')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText('182.30')).toBeInTheDocument();
    expect(screen.getByText('181.00')).toBeInTheDocument();
    expect(screen.getByText('Earnings')).toBeInTheDocument();
    expect(screen.getByText('+3.5%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument();
  });

  it('colors R:R green when >= 2.0', () => {
    renderRow({ ...baseCandidate, rr: 2.5 });
    const rrCell = screen.getByTestId('rr-cell');
    expect(rrCell.className).toContain('text-success');
  });

  it('colors R:R amber when >= 1.5 and < 2.0', () => {
    renderRow({ ...baseCandidate, rr: 1.8 });
    const rrCell = screen.getByTestId('rr-cell');
    expect(rrCell.className).toContain('text-warning');
  });

  it('colors R:R red when < 1.5', () => {
    renderRow({ ...baseCandidate, rr: 1.2 });
    const rrCell = screen.getByTestId('rr-cell');
    expect(rrCell.className).toContain('text-danger');
  });

  it('renders green tag for breakout setup', () => {
    renderRow({ ...baseCandidate, setup: 'breakout' });
    const tag = screen.getByText('breakout');
    expect(tag.className).toContain('text-success');
  });

  it('renders blue tag for pullback setup', () => {
    renderRow({ ...baseCandidate, setup: 'pullback' });
    const tag = screen.getByText('pullback');
    expect(tag.className).toContain('text-accent');
  });

  it('renders gray tag for none setup', () => {
    renderRow({ ...baseCandidate, setup: 'none' });
    const tag = screen.getByText('none');
    expect(tag.className).toContain('text-text-secondary');
  });

  it('shows blue dot when isHeld is true', () => {
    renderRow(baseCandidate, true);
    const heldCell = screen.getByTestId('held-cell');
    const svg = heldCell.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.innerHTML).toContain('circle');
  });

  it('does not show dot when isHeld is false', () => {
    renderRow(baseCandidate, false);
    const heldCell = screen.getByTestId('held-cell');
    expect(heldCell.querySelector('svg')).not.toBeInTheDocument();
  });

  it('shows positive gain in green', () => {
    renderRow({ ...baseCandidate, gain: 5.2 });
    const el = screen.getByText('+5.2%');
    expect(el.className).toContain('text-success');
  });

  it('shows negative gain in red', () => {
    renderRow({ ...baseCandidate, gain: -2.1 });
    const el = screen.getByText('-2.1%');
    expect(el.className).toContain('text-danger');
  });

  it('does not render gain when undefined', () => {
    renderRow({ ...baseCandidate, gain: undefined });
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('calls onAnalyze when Analyze button clicked', () => {
    const onClick = vi.fn();
    renderRow(baseCandidate, false, onClick);
    screen.getByRole('button', { name: 'Analyze' }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
