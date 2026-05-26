import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CatalystContextCard from './CatalystContextCard';
import type { CatalystOpportunity } from '@/features/intelligence/catalysts/types';

const baseOpportunity: CatalystOpportunity = {
  ticker: 'STLD',
  state: 'CATALYST_ACTIVE',
  catalystStrength: 8.0,
  thesis: 'Domestic steel prices rise due to tariffs.',
  keyRisks: ['policy reversal'],
  sources: ['https://reuters.com/1'],
  reportId: 'r1',
  generatedAt: '2026-05-24T10:00:00Z',
};

it('renders the thesis text', () => {
  render(<CatalystContextCard opportunity={baseOpportunity} />);
  expect(screen.getByText('Domestic steel prices rise due to tariffs.')).toBeInTheDocument();
});

it('renders the state badge', () => {
  render(<CatalystContextCard opportunity={baseOpportunity} />);
  expect(screen.getByText(/CATALYST_ACTIVE/i)).toBeInTheDocument();
});

it('renders key risks', () => {
  render(<CatalystContextCard opportunity={baseOpportunity} />);
  expect(screen.getByText('policy reversal')).toBeInTheDocument();
});

it('sources are collapsed by default', () => {
  render(<CatalystContextCard opportunity={baseOpportunity} />);
  const details = document.querySelector('details');
  expect(details).not.toBeNull();
  expect(details?.hasAttribute('open')).toBe(false);
});
