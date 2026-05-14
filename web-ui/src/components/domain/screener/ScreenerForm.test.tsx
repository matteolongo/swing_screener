import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import ScreenerForm from './ScreenerForm';
import { t } from '@/i18n/t';
import type { UniverseSummary } from '@/features/screener/types';

const mockUniverse: UniverseSummary = {
  id: 'broad_market_stocks',
  description: 'Broad Market Stocks',
  kind: 'equity',
  benchmark: 'SPY',
  member_count: 500,
  source: 'manual',
  source_asof: '2026-01-01',
  last_reviewed_at: '2026-01-01',
  stale_after_days: 30,
  currencies: ['USD'],
  exchange_mics: ['XNYS', 'XNAS'],
  source_adapter: 'manual',
  source_documents: [],
  refreshable: false,
  days_since_review: 0,
  freshness_status: 'fresh',
  is_stale: false,
};

const defaultProps = {
  selectedUniverse: 'broad_market_stocks',
  setSelectedUniverse: vi.fn(),
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
  instrumentFilter: 'all' as const,
  setInstrumentFilter: vi.fn(),
  includeOtc: false,
  setIncludeOtc: vi.fn(),
  recommendedOnly: false,
  setRecommendedOnly: vi.fn(),
  requireWeeklyUptrend: false,
  setRequireWeeklyUptrend: vi.fn(),
  actionFilter: 'all' as const,
  setActionFilter: vi.fn(),
  universes: [mockUniverse],
  isLoading: false,
  onRun: vi.fn(),
  isCollapsed: false,
  onToggleCollapsed: vi.fn(),
};

describe('ScreenerForm - collapsed state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows universe description and member count in collapsed view', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} isCollapsed={true} />);
    expect(screen.getByText('Broad Market Stocks')).toBeInTheDocument();
    // Member count span contains "500 members" text
    expect(screen.getByText((content, element) => {
      return element?.tagName === 'SPAN' && /500/.test(content) && /members/i.test(content);
    })).toBeInTheDocument();
  });

  it('shows the Run button in collapsed view', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} isCollapsed={true} />);
    expect(screen.getByText(t('screener.controls.run'))).toBeInTheDocument();
  });

  it('shows "Adjust filters" label in collapsed view', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} isCollapsed={true} />);
    expect(screen.getByText(t('screener.controls.adjustFilters'))).toBeInTheDocument();
  });

  it('calls onToggleCollapsed when "Adjust filters" button is clicked', async () => {
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

  it('shows weeklyUptrend pill when requireWeeklyUptrend is true', () => {
    renderWithProviders(
      <ScreenerForm {...defaultProps} isCollapsed={true} requireWeeklyUptrend={true} />
    );
    expect(screen.getByText(t('screener.controls.weeklyUptrend'))).toBeInTheDocument();
  });

  it('shows recommendedOnly pill when recommendedOnly is true', () => {
    renderWithProviders(
      <ScreenerForm {...defaultProps} isCollapsed={true} recommendedOnly={true} />
    );
    expect(screen.getByText(t('screener.controls.recommendedOnlyShort'))).toBeInTheDocument();
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

  it('calls onToggleCollapsed when "Hide filters" is clicked', async () => {
    const onToggleCollapsed = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ScreenerForm {...defaultProps} isCollapsed={false} onToggleCollapsed={onToggleCollapsed} />
    );
    const hideBtn = screen.getByRole('button', { name: t('screener.controls.hideFilters') });
    await user.click(hideBtn);
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('shows universe selector in expanded view', () => {
    renderWithProviders(<ScreenerForm {...defaultProps} isCollapsed={false} />);
    expect(screen.getByRole('combobox', { name: t('screener.controls.universe') })).toBeInTheDocument();
  });
});
