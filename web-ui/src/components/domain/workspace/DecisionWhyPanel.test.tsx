import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DecisionWhyPanel from './DecisionWhyPanel';
import { t } from '@/i18n/t';

const summary = {
  whatToDo: 'Place a stop-buy above 152.',
  whyNow: 'Breakout from a 6-week base on rising volume.',
  mainRisk: 'Earnings in 5 days could whipsaw the entry.',
} as const;

describe('DecisionWhyPanel', () => {
  it('renders what-to-do / why-now / watch-for from the screener summary', () => {
    render(<DecisionWhyPanel summary={summary as never} aiSummaryLine={null} />);
    expect(screen.getByText(t('workspacePage.panels.analysis.decisionWhy.title'))).toBeInTheDocument();
    expect(screen.getByText(summary.whatToDo)).toBeInTheDocument();
    expect(screen.getByText(summary.whyNow)).toBeInTheDocument();
    expect(screen.getByText(summary.mainRisk)).toBeInTheDocument();
  });

  it('appends the AI summary line to why-now when present', () => {
    render(<DecisionWhyPanel summary={summary as never} aiSummaryLine="AI: momentum confirms continuation." />);
    const matches = screen.getAllByText((_c, el) => el?.textContent?.includes('AI: momentum confirms continuation.') ?? false);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows guidance fallback when no summary is available', () => {
    render(<DecisionWhyPanel summary={null} aiSummaryLine={null} />);
    expect(screen.getByText(t('workspacePage.panels.analysis.decisionWhy.noGuidance'))).toBeInTheDocument();
  });
});
