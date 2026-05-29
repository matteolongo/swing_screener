import { describe, expect, it } from 'vitest';
import { transformScreenerResponse, type ScreenerResponseAPI } from '@/features/screener/types';

describe('transformScreenerResponse', () => {
  it('maps execution guidance and fundamentals fields from API to UI shape', () => {
    const apiResponse: ScreenerResponseAPI = {
      asof_date: '2026-03-02',
      total_screened: 1,
      data_freshness: 'final_close',
      candidates: [
        {
          ticker: 'AAPL',
          close: 100,
          sma_20: 99,
          sma_50: 95,
          sma_200: 90,
          atr: 2,
          momentum_6m: 0.2,
          momentum_12m: 0.3,
          rel_strength: 1.1,
          sector_rs: 0.04,
          score: 0.8,
          confidence: 78,
          rank: 1,
          priority_rank: 1,
          fundamentals_coverage_status: 'supported',
          fundamentals_freshness_status: 'current',
          fundamentals_summary: 'Growth metrics are supportive.',
          signal: 'breakout',
          days_to_earnings: 12,
          dist_52w_high_pct: -0.03,
          near_52w_high: true,
          sector_rotation_context: { fast_rs: 0.04, slow_rs: 0.02, in_rotation: true },
          suggested_order_type: 'BUY_STOP',
          suggested_order_price: 101.2,
          execution_note: 'Breakout not triggered yet. Place BUY STOP slightly above breakout_level.',
          decision_summary: {
            symbol: 'AAPL',
            action: 'BUY_NOW',
            conviction: 'high',
            technical_label: 'strong',
            fundamentals_label: 'strong',
            valuation_label: 'fair',
            catalyst_label: 'active',
            why_now: 'Setup timing is ready and the business-quality read supports conviction.',
            what_to_do: 'Use the current trade plan and keep sizing inside your normal risk budget.',
            main_risk: 'The trade still needs disciplined risk management because no single input guarantees follow-through.',
            trade_plan: {
              entry: 100,
              stop: 96,
              target: 108,
              rr: 2,
            },
            valuation_context: {
              method: 'earnings_multiple',
              summary:
                'Valuation looks fair on current fundamentals. Fair value range is 95.12 to 119.51 using earnings multiple, and the current price is 6.8% below the base fair value. Trailing PE is 24.6x, price-to-sales is 5.1x, book value per share is 18.40, and price-to-book is 5.4x.',
              trailing_pe: 24.6,
              price_to_sales: 5.1,
              book_value_per_share: 18.4,
              price_to_book: 5.4,
              book_to_price: 0.1852,
              fair_value_low: 95.12,
              fair_value_base: 107.32,
              fair_value_high: 119.51,
              premium_discount_pct: -6.8,
            },
            drivers: {
              positives: ['Technical setup is ready.'],
              negatives: [],
              warnings: ['No cached catalyst snapshot is available yet.'],
            },
          },
        },
      ],
    };

    const result = transformScreenerResponse(apiResponse);
    expect(result.candidates[0].suggestedOrderType).toBe('BUY_STOP');
    expect(result.candidates[0].suggestedOrderPrice).toBe(101.2);
    expect(result.candidates[0].executionNote).toContain('BUY STOP');
    expect(result.candidates[0].priorityRank).toBe(1);
    expect(result.candidates[0].fundamentalsCoverageStatus).toBe('supported');
    expect(result.candidates[0].fundamentalsSummary).toBe('Growth metrics are supportive.');
    expect(result.candidates[0].sectorRs).toBe(0.04);
    expect(result.candidates[0].daysToEarnings).toBe(12);
    expect(result.candidates[0].dist52wHighPct).toBe(-0.03);
    expect(result.candidates[0].near52wHigh).toBe(true);
    expect(result.candidates[0].sectorRotationContext).toEqual({ fast_rs: 0.04, slow_rs: 0.02, in_rotation: true });
    expect(result.candidates[0].decisionSummary?.action).toBe('BUY_NOW');
    expect(result.candidates[0].decisionSummary?.tradePlan.rr).toBe(2);
    expect(result.candidates[0].decisionSummary?.valuationContext.method).toBe('earnings_multiple');
    expect(result.candidates[0].decisionSummary?.valuationContext.trailingPe).toBe(24.6);
    expect(result.candidates[0].decisionSummary?.valuationContext.bookValuePerShare).toBe(18.4);
    expect(result.candidates[0].decisionSummary?.valuationContext.priceToBook).toBe(5.4);
    expect(result.candidates[0].decisionSummary?.valuationContext.fairValueBase).toBe(107.32);
  });

  it('maps data source summary from API payload', () => {
    const apiResponse: ScreenerResponseAPI = {
      asof_date: '2026-03-02',
      total_screened: 1,
      data_freshness: 'final_close',
      candidates: [
        {
          ticker: 'AAPL',
          close: 100,
          sma_20: 99,
          sma_50: 95,
          sma_200: 90,
          atr: 2,
          momentum_6m: 0.2,
          momentum_12m: 0.3,
          rel_strength: 1.1,
          score: 0.8,
          confidence: 78,
          rank: 1,
          data_source_summary: {
            market_data: {
              provider: 'yfinance',
              status: 'ok',
              quality_score: 0.65,
              delay_policy: 'delayed_or_eod',
              warnings: ['unofficial_provider'],
            },
            fundamentals: {
              provider: 'sec_edgar',
              status: 'ok',
              quality_score: 0.9,
            },
          },
        },
      ],
    };

    const result = transformScreenerResponse(apiResponse);

    expect(result.candidates[0].dataSourceSummary?.marketData?.provider).toBe('yfinance');
    expect(result.candidates[0].dataSourceSummary?.marketData?.qualityScore).toBe(0.65);
    expect(result.candidates[0].dataSourceSummary?.marketData?.delayPolicy).toBe('delayed_or_eod');
    expect(result.candidates[0].dataSourceSummary?.marketData?.warnings).toEqual(['unofficial_provider']);
    expect(result.candidates[0].dataSourceSummary?.fundamentals?.provider).toBe('sec_edgar');
  });

  it('maps camelCase data source summary from API payload', () => {
    const apiResponse: ScreenerResponseAPI = {
      asof_date: '2026-03-02',
      total_screened: 1,
      data_freshness: 'final_close',
      candidates: [
        {
          ticker: 'MSFT',
          close: 300,
          sma_20: 295,
          sma_50: 290,
          sma_200: 280,
          atr: 5,
          momentum_6m: 0.15,
          momentum_12m: 0.22,
          rel_strength: 1.05,
          score: 0.75,
          confidence: 72,
          rank: 2,
          dataSourceSummary: {
            marketData: {
              provider: 'alpaca',
              status: 'degraded',
              qualityScore: 0.8,
              delayPolicy: 'intraday',
              warnings: ['limited_history'],
            },
            calendar: {
              provider: 'finnhub',
              status: 'ok',
              qualityScore: 0.85,
            },
          },
        },
      ],
    };

    const result = transformScreenerResponse(apiResponse);

    expect(result.candidates[0].dataSourceSummary?.marketData?.provider).toBe('alpaca');
    expect(result.candidates[0].dataSourceSummary?.marketData?.status).toBe('degraded');
    expect(result.candidates[0].dataSourceSummary?.marketData?.qualityScore).toBe(0.8);
    expect(result.candidates[0].dataSourceSummary?.marketData?.delayPolicy).toBe('intraday');
    expect(result.candidates[0].dataSourceSummary?.calendar?.provider).toBe('finnhub');
  });
});
