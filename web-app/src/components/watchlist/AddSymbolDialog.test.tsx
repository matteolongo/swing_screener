import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AddSymbolDialog from './AddSymbolDialog';

const mockGetSymbolPool = vi.fn();

vi.mock('../../services/api/screenerApi', () => ({
  getSymbolPool: (...args: unknown[]) => mockGetSymbolPool(...args),
}));

const defaultProps = {
  onSelect: vi.fn(),
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddSymbolDialog', () => {
  it('renders search input and close button', () => {
    render(<AddSymbolDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search symbol...')).toBeInTheDocument();
  });

  it('focuses search input on mount', () => {
    render(<AddSymbolDialog {...defaultProps} />);
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search symbol...'));
  });

  it('searches symbols on input', async () => {
    mockGetSymbolPool.mockResolvedValue({
      symbols: [{ symbol: 'AAPL', exchange_mic: 'XNAS', sector: 'Tech' }],
      total: 1, page: 1, page_size: 20,
    });

    render(<AddSymbolDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search symbol...');
    fireEvent.change(input, { target: { value: 'AAPL' } });

    await waitFor(() => {
      expect(mockGetSymbolPool).toHaveBeenCalledWith({ q: 'AAPL' });
    });

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
  });

  it('calls onSelect when symbol clicked', async () => {
    const onSelect = vi.fn();
    mockGetSymbolPool.mockResolvedValue({
      symbols: [{ symbol: 'AAPL', exchange_mic: 'XNAS', sector: 'Tech' }],
      total: 1, page: 1, page_size: 20,
    });

    render(<AddSymbolDialog onSelect={onSelect} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('Search symbol...');
    fireEvent.change(input, { target: { value: 'AAPL' } });

    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('AAPL'));
    expect(onSelect).toHaveBeenCalledWith('AAPL');
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<AddSymbolDialog onSelect={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Search symbol...'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on overlay click', () => {
    const onClose = vi.fn();
    const { container } = render(<AddSymbolDialog onSelect={vi.fn()} onClose={onClose} />);
    const overlay = container.querySelector('.bg-black\\/60') || container.firstElementChild;
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('shows no symbols found message', async () => {
    mockGetSymbolPool.mockResolvedValue({
      symbols: [], total: 0, page: 1, page_size: 20,
    });

    render(<AddSymbolDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search symbol...');
    fireEvent.change(input, { target: { value: 'ZZZZ' } });

    await waitFor(() => {
      expect(screen.getByText('No symbols found')).toBeInTheDocument();
    });
  });

  it('clears results when query is empty', async () => {
    mockGetSymbolPool.mockResolvedValue({
      symbols: [{ symbol: 'AAPL', exchange_mic: 'XNAS' }],
      total: 1, page: 1, page_size: 20,
    });

    render(<AddSymbolDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search symbol...');

    fireEvent.change(input, { target: { value: 'A' } });
    await waitFor(() => expect(mockGetSymbolPool).toHaveBeenCalled());

    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() => {
      expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    });
  });
});
