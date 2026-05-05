import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { t } from '@/i18n/t';
import type { ConcentrationGroup } from '@/features/portfolio/api';
import ConcentrationBar from './ConcentrationBar';

const highConcentration: ConcentrationGroup[] = [
  { country: 'NL', riskAmount: 150, riskPct: 75, positionCount: 2, warning: true },
  { country: 'US', riskAmount: 50, riskPct: 25, positionCount: 1, warning: false },
];

const lowConcentration: ConcentrationGroup[] = [
  { country: 'US', riskAmount: 50, riskPct: 40, positionCount: 1, warning: false },
  { country: 'NL', riskAmount: 45, riskPct: 36, positionCount: 2, warning: false },
];

describe('ConcentrationBar', () => {
  it('renders nothing without concentration groups', () => {
    const { container } = renderWithProviders(<ConcentrationBar groups={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the top concentration group', () => {
    renderWithProviders(<ConcentrationBar groups={highConcentration} />);

    expect(screen.getByText(t('concentrationBar.title'))).toBeInTheDocument();
    expect(screen.getByText(t('concentrationBar.warningLabel', { country: 'NL', pct: '75' }))).toBeInTheDocument();
  });

  it('marks warning concentrations', () => {
    const { container } = renderWithProviders(<ConcentrationBar groups={highConcentration} />);

    expect(container.querySelector('[data-warning="true"]')).toBeInTheDocument();
  });

  it('keeps normal concentrations non-warning', () => {
    const { container } = renderWithProviders(<ConcentrationBar groups={lowConcentration} />);

    expect(screen.getByText(t('concentrationBar.normalLabel', { country: 'US', pct: '40' }))).toBeInTheDocument();
    expect(container.querySelector('[data-warning="false"]')).toBeInTheDocument();
  });
});
