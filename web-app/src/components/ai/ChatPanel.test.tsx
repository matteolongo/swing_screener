import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPanel from './ChatPanel';

const messages = [
  { role: 'user' as const, content: 'What is the outlook?', ts: '2025-07-28T20:00:00Z' },
  { role: 'assistant' as const, content: 'Bullish pattern forming', ts: '2025-07-28T20:00:01Z' },
  { role: 'user' as const, content: 'What is the stop level?', ts: '2025-07-28T20:00:02Z' },
  { role: 'assistant' as const, content: 'Stop at $170', evidence_used: ['resistance level', 'volume analysis'], ts: '2025-07-28T20:00:03Z' },
];

describe('ChatPanel', () => {
  it('renders messages as chat bubbles', () => {
    render(<ChatPanel messages={messages} onSend={vi.fn()} />);
    expect(screen.getByText('What is the outlook?')).toBeInTheDocument();
    expect(screen.getByText('Bullish pattern forming')).toBeInTheDocument();
    expect(screen.getByText('What is the stop level?')).toBeInTheDocument();
    expect(screen.getByText('Stop at $170')).toBeInTheDocument();
  });

  it('shows evidence_used for assistant messages', () => {
    render(<ChatPanel messages={messages} onSend={vi.fn()} />);
    expect(screen.getByText((content) => content.includes('resistance level'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('volume analysis'))).toBeInTheDocument();
  });

  it('sends message on button click', () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={[]} onSend={onSend} />);
    const input = screen.getByPlaceholderText('Ask a follow-up question about this analysis');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(screen.getByText('Send'));
    expect(onSend).toHaveBeenCalledWith('Test message');
  });

  it('sends message on Enter key', () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={[]} onSend={onSend} />);
    const input = screen.getByPlaceholderText('Ask a follow-up question about this analysis');
    fireEvent.change(input, { target: { value: 'Enter message' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Enter message');
  });

  it('does not send empty message', () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={[]} onSend={onSend} />);
    const input = screen.getByPlaceholderText('Ask a follow-up question about this analysis');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables input and button when disabled prop is true', () => {
    render(<ChatPanel messages={[]} onSend={vi.fn()} disabled={true} />);
    const input = screen.getByPlaceholderText('Ask a follow-up question about this analysis');
    expect(input).toBeDisabled();
    expect(screen.getByText('Send')).toBeDisabled();
  });

  it('shows empty state when no messages', () => {
    render(<ChatPanel messages={[]} onSend={vi.fn()} />);
    expect(screen.getByText('Ask a follow-up question about this analysis')).toBeInTheDocument();
  });
});
