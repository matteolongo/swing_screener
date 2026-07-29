import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PositionReview from './PositionReview';

const mockRequestPositionReview = vi.fn();

vi.mock('../../services/api/aiApi', () => ({
  requestPositionReview: (...args: unknown[]) => mockRequestPositionReview(...args),
}));

const mockReviewResponse = {
  move_explanation: 'Price moved 3% in your favor after strong earnings',
  thesis_status: 'confirmed',
  profit_protection_guidance: 'Consider trailing stop to lock in gains',
  stop_advice: 'Move stop to breakeven at $175.00',
  stop_price: 175,
  macro_overlay: 'Broad market remains supportive for tech',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestPositionReview.mockResolvedValue(mockReviewResponse);
});

describe('PositionReview', () => {
  it('calls requestPositionReview on mount', async () => {
    render(<PositionReview positionId="pos-1" symbol="AAPL" />);
    await waitFor(() => {
      expect(mockRequestPositionReview).toHaveBeenCalledWith('pos-1');
    });
  });

  it('shows loading state initially', () => {
    mockRequestPositionReview.mockImplementation(() => new Promise(() => {}));
    render(<PositionReview positionId="pos-1" symbol="AAPL" />);
    expect(screen.getByText('Loading position review...')).toBeInTheDocument();
  });

  it('renders all sections after load', async () => {
    render(<PositionReview positionId="pos-1" symbol="AAPL" />);
    await waitFor(() => {
      expect(screen.getByText('Price moved 3% in your favor after strong earnings')).toBeInTheDocument();
    });
    expect(screen.getByText('confirmed')).toBeInTheDocument();
    expect(screen.getByText('Consider trailing stop to lock in gains')).toBeInTheDocument();
    expect(screen.getByText('Move stop to breakeven at $175.00')).toBeInTheDocument();
    expect(screen.getByText('Broad market remains supportive for tech')).toBeInTheDocument();
  });

  it('shows thesis status with confirmed badge', async () => {
    render(<PositionReview positionId="pos-1" symbol="AAPL" />);
    await waitFor(() => {
      expect(screen.getByText('Thesis Status')).toBeInTheDocument();
    });
  });

  it('shows stop price if available', async () => {
    render(<PositionReview positionId="pos-1" symbol="AAPL" />);
    await waitFor(() => {
      expect(screen.getByText((c) => c.includes('breakeven'))).toBeInTheDocument();
    });
  });

  it('shows error state on failure', async () => {
    mockRequestPositionReview.mockRejectedValue(new Error('Failed to load'));
    render(<PositionReview positionId="pos-1" symbol="AAPL" />);
    await waitFor(() => {
      expect(screen.getByText('Could not load position review')).toBeInTheDocument();
    });
  });
});
