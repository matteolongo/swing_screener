import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import ScreenerForm from './ScreenerForm';
import { t } from '@/i18n/t';

const defaultProps = {
  taxonomyFilter: {},
  setTaxonomyFilter: vi.fn(),
  presetId: null,
  setPresetId: vi.fn(),
  topN: 20,
  setTopN: vi.fn(),
  minPrice: 5,
  setMinPrice: vi.fn(),
  maxPrice: 400,
  setMaxPrice: vi.fn(),
  currencyFilter: 'all' as const,
  setCurrencyFilter: vi.fn(),
  exchangeFilter: 'all' as const,
  setExchangeFilter: vi.fn(),
  includeOtc: false,
  setIncludeOtc: vi.fn(),
  recommendedOnly: false,
  setRecommendedOnly: vi.fn(),
  requireWeeklyUptrend: false,
  setRequireWeeklyUptrend: vi.fn(),
  actionFilter: 'all' as const,
  setActionFilter: vi.fn(),
  isLoading: false,
  onRun: vi.fn(),
  isCollapsed: false,
  onToggleCollapsed: vi.fn(),
  forceRefresh: false,
  setForceRefresh: vi.fn(),
};

describe('ScreenerForm - collapsed state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the Run button in collapsed view', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} isCollapsed={true} />);
    expect(screen.getAllByText(t('screener.controls.run')).length).toBeGreaterThan(0);
  });

  it('shows "Advanced filters" label in collapsed view', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} isCollapsed={true} />);
    expect(screen.getByText(t('screener.controls.adjustFilters'))).toBeInTheDocument();
  });

  it('calls onToggleCollapsed when "Advanced filters" button is clicked', async () => {
    const onToggleCollapsed = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ScreenerForm {...defaultProps} isCollapsed={true} onToggleCollapsed={onToggleCollapsed} />
    );
    const adjustBtn = screen.getByRole('button', { name: t('screener.controls.adjustFilters') });
    await user.click(adjustBtn);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('shows topN and price range pills in collapsed view', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} isCollapsed={true} topN={25} minPrice={10} maxPrice={300} />);
    expect(screen.getByText(`${t('screener.controls.topN')}: 25`)).toBeInTheDocument();
    expect(screen.getByText('$10–$300')).toBeInTheDocument();
  });

  it('shows currency pill when currencyFilter is not "all"', () => {
    renderWithProviders(
      <ScreenerForm {...defaultProps} isCollapsed={true} currencyFilter="usd" />
    );
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('shows noOtc pill when includeOtc is false', () => {
    renderWithProviders(
      <ScreenerForm {...defaultProps} isCollapsed={true} includeOtc={false} />
    );
    expect(screen.getByText(t('screener.controls.noOtc'))).toBeInTheDocument();
  });
});

describe('ScreenerForm - expanded state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Hide filters" button text in expanded view', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} isCollapsed={false} />);
    expect(screen.getByText(t('screener.controls.hideFilters'))).toBeInTheDocument();
  });

  it('renders the quick filter bar and no universe selector', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} isCollapsed={false} />);
    expect(screen.getByText(t('screener.taxonomy.region.label'))).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: t('screener.controls.universe') })
    ).not.toBeInTheDocument();
  });
});

describe('ScreenerForm - forceRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders forceRefresh checkbox unchecked by default', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} forceRefresh={false} />);
    const cb = screen.getByLabelText(t('screener.controls.forceRefresh')) as HTMLInputElement;
    expect(cb.checked).toBe(false);
  });

  it('shows warning when forceRefresh is true', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} forceRefresh={true} />);
    expect(screen.getByText(t('screener.controls.forceRefreshWarning'))).toBeInTheDocument();
  });
});
