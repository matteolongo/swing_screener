import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import GlossaryGrid from './GlossaryGrid';

describe('GlossaryGrid', () => {
  it('renders all glossary entries', () => {
    renderWithProviders(<GlossaryGrid />);

    expect(screen.getByText('Reward-to-Risk (RR)')).toBeInTheDocument();
    expect(screen.getByText('Relative Strength (RS)')).toBeInTheDocument();
    expect(screen.getByText('Average True Range (ATR)')).toBeInTheDocument();
    expect(screen.getByText('Composite Score')).toBeInTheDocument();
    expect(screen.getByText('Setup Confidence')).toBeInTheDocument();
    expect(screen.getByText('6-Month Momentum')).toBeInTheDocument();
    expect(screen.getByText('12-Month Momentum')).toBeInTheDocument();
    expect(screen.getByText('Risk Percent of Account')).toBeInTheDocument();
    expect(screen.getByText('Fees Relative to Risk')).toBeInTheDocument();
    expect(screen.getByText('Current R Multiple')).toBeInTheDocument();
  });
});
