import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import PracticeCardExercise from './PracticeCardExercise';

describe('PracticeCardExercise', () => {
  it('renders prompt and three option buttons', () => {
    renderWithProviders(
      <PracticeCardExercise
        exercise={{
          prompt: 'AAPL: What would you do?',
          options: ['TRADE_NOW', 'WAIT', 'AVOID'],
          correctAnswer: 'WAIT',
          exerciseState: 'prompt',
        }}
        onAnswer={vi.fn()}
        onReveal={vi.fn()}
      />,
    );

    expect(screen.getByText('AAPL: What would you do?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trade now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wait' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Avoid' })).toBeInTheDocument();
  });

  it('shows feedback and reveal action after answering', () => {
    renderWithProviders(
      <PracticeCardExercise
        exercise={{
          prompt: 'AAPL: What would you do?',
          options: ['TRADE_NOW', 'WAIT', 'AVOID'],
          correctAnswer: 'WAIT',
          exerciseState: 'answered',
          userAnswer: 'TRADE_NOW',
        }}
        onAnswer={vi.fn()}
        onReveal={vi.fn()}
      />,
    );

    expect(screen.getByText('The system sees this setup differently. Review the evidence before acting.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /see the system’s analysis/i })).toBeInTheDocument();
  });
});
