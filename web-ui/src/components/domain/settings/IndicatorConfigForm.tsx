import { useConfigStore } from '@/stores/configStore';
import HelpTooltip from '@/components/common/HelpTooltip';

export default function IndicatorConfigForm() {
  const { config, updateIndicators } = useConfigStore();
  const { indicators } = config;

  return (
    <div className="space-y-6">
      {/* SMA Windows */}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          SMA Windows (Fast / Mid / Long)
          <HelpTooltip
            short="Simple Moving Average periods for trend identification"
            title="SMA Windows"
            content={
              <div className="space-y-4">
                <p>
                  Simple Moving Averages smooth out price action to identify trends.
                </p>
                <div>
                  <h4 className="font-semibold mb-2">Formula:</h4>
                  <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                    SMA(n) = (P1 + P2 + ... + Pn) / n
                  </code>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Standard Windows:</h4>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>SMA20:</strong> Short-term trend (~1 month of trading days)</li>
                    <li><strong>SMA50:</strong> Intermediate trend (~2.5 months)</li>
                    <li><strong>SMA200:</strong> Long-term trend (~1 year)</li>
                  </ul>
                </div>
                <div className="bg-primary/10 border border-primary/30 rounded p-4">
                  <p className="font-semibold">How we use them:</p>
                  <p className="text-sm mt-2">
                    • Price above SMA200 = uptrend filter<br />
                    • SMA50 {'>'} SMA200 = trend strength confirmation<br />
                    • SMA20 = trailing stop reference (after +2R)
                  </p>
                </div>
              </div>
            }
          />
        </label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">Fast (20)</label>
            <input
              type="number"
              value={indicators.smaFast}
              onChange={(e) => updateIndicators({ smaFast: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="5"
              max="50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">Mid (50)</label>
            <input
              type="number"
              value={indicators.smaMid}
              onChange={(e) => updateIndicators({ smaMid: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="20"
              max="100"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">Long (200)</label>
            <input
              type="number"
              value={indicators.smaLong}
              onChange={(e) => updateIndicators({ smaLong: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="100"
              max="300"
            />
          </div>
        </div>
      </div>

      {/* ATR Window */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            ATR Window
            <HelpTooltip
              short="Period for volatility calculation (default: 14 days)"
              title="ATR Window"
              content={
                <div className="space-y-4">
                  <p>
                    Number of trading days used to calculate Average True Range (volatility measure).
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Standard: 14 days</h4>
                    <p className="text-sm">
                      Developed by J. Welles Wilder. Industry standard is 14 periods. 
                      Most traders stick with this default.
                    </p>
                  </div>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={indicators.atrWindow}
            onChange={(e) => updateIndicators({ atrWindow: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-border rounded-lg"
            min="7"
            max="30"
          />
        </div>
      </div>

      {/* Entry Signal Windows */}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          Entry Signal Windows
          <HelpTooltip
            short="Breakout lookback and pullback MA windows"
            title="Entry Signal Windows"
            content={
              <div className="space-y-4">
                <p>
                  These windows control breakout and pullback entry signals used across the screener and backtests.
                </p>
                <div>
                  <h4 className="font-semibold mb-2">Breakout:</h4>
                  <p className="text-sm">
                    Trigger when today&apos;s close exceeds the prior high over the lookback period.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Pullback:</h4>
                  <p className="text-sm">
                    Trigger when yesterday was below the MA and today closes back above it.
                  </p>
                </div>
              </div>
            }
          />
        </label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">Breakout Lookback</label>
            <input
              type="number"
              value={indicators.breakoutLookback}
              onChange={(e) => updateIndicators({ breakoutLookback: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="10"
              max="200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">Pullback MA</label>
            <input
              type="number"
              value={indicators.pullbackMa}
              onChange={(e) => updateIndicators({ pullbackMa: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="5"
              max="100"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">Min History</label>
            <input
              type="number"
              value={indicators.minHistory}
              onChange={(e) => updateIndicators({ minHistory: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="50"
              max="500"
            />
          </div>
        </div>
      </div>

      {/* Momentum Lookback */}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          Momentum Lookback (6m / 12m in trading days)
          <HelpTooltip
            short="Trading days for momentum calculation"
            title="Momentum Lookback Periods"
            content={
              <div className="space-y-4">
                <p>
                  We measure momentum (% return) over 6 and 12 month periods.
                </p>
                <div>
                  <h4 className="font-semibold mb-2">Trading Days:</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    <li>126 days ≈ 6 months (252 trading days/year ÷ 2)</li>
                    <li>252 days ≈ 12 months (1 year)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Formula:</h4>
                  <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                    mom_6m = (Price_now / Price_126_days_ago) - 1
                  </code>
                </div>
                <div className="bg-primary/10 border border-primary/30 rounded p-4">
                  <p className="font-semibold">Why measure momentum?</p>
                  <p className="text-sm mt-2">
                    Academic research shows momentum persists: past winners tend to keep winning 
                    (at least for 3-12 months). We rank stocks by momentum to find the strongest.
                  </p>
                </div>
              </div>
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">6 months (126)</label>
            <input
              type="number"
              value={indicators.lookback6m}
              onChange={(e) => updateIndicators({ lookback6m: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="60"
              max="200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400">12 months (252)</label>
            <input
              type="number"
              value={indicators.lookback12m}
              onChange={(e) => updateIndicators({ lookback12m: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-border rounded-lg"
              min="200"
              max="300"
            />
          </div>
        </div>
      </div>

      {/* Benchmark */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            Benchmark Ticker
            <HelpTooltip
              short="Reference index for relative strength calculation"
              title="Benchmark Ticker"
              content={
                <div className="space-y-4">
                  <p>
                    The benchmark is used to calculate Relative Strength (RS).
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Formula:</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      RS = mom_6m[stock] - mom_6m[benchmark]
                    </code>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Example:</h4>
                    <p className="text-sm">
                      Stock up 20%, SPY up 10%<br />
                      RS = +10% (outperforming)
                    </p>
                  </div>
                  <p className="text-sm">
                    Default: <strong>SPY</strong> (S&P 500 ETF). We want stocks beating the market.
                  </p>
                </div>
              }
            />
          </label>
          <input
            type="text"
            value={indicators.benchmark}
            onChange={(e) => updateIndicators({ benchmark: e.target.value.toUpperCase() })}
            className="w-full px-4 py-2 border border-border rounded-lg uppercase"
            placeholder="SPY"
          />
        </div>
      </div>
    </div>
  );
}
