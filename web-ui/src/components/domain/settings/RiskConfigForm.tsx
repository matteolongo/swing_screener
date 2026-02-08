import { useConfigStore } from '@/stores/configStore';
import HelpTooltip from '@/components/common/HelpTooltip';
import { formatCurrency } from '@/utils/formatters';

export default function RiskConfigForm() {
  const { config, updateRisk } = useConfigStore();
  const { risk } = config;

  const riskAmount = risk.accountSize * risk.riskPct;
  const maxPositionValue = risk.accountSize * risk.maxPositionPct;

  return (
    <div className="space-y-6">
      {/* Account Size */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            Account Size
            <HelpTooltip
              short="Total capital available for trading"
              title="Account Size"
              content={
                <div className="space-y-4">
                  <p>
                    This is the total amount of capital you have allocated for swing trading.
                  </p>
                  <div className="bg-warning/10 border border-warning/30 rounded p-4">
                    <p className="font-semibold text-warning-foreground">⚠️ Important</p>
                    <p className="text-sm mt-2">
                      Only use capital you can afford to lose. Never trade with rent money, emergency funds, or borrowed money.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Guidelines:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Start small (even $5,000 is enough to learn)</li>
                      <li>Keep 6+ months of expenses in savings first</li>
                      <li>This should be separate from retirement accounts</li>
                    </ul>
                  </div>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={risk.accountSize}
            onChange={(e) => updateRisk({ accountSize: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            min="0"
            step="1000"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          Total trading capital
        </div>
      </div>

      {/* Risk Per Trade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            Risk Per Trade (%)
            <HelpTooltip
              short="Max account % to risk on a single trade"
              title="Risk Per Trade"
              content={
                <div className="space-y-4">
                  <p>
                    Industry standard: <strong>1-2%</strong> of your account per trade.
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Formula:</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      Risk Amount = Account Size × Risk %
                    </code>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Example:</h4>
                    <p className="text-sm">
                      $50,000 account × 1% = <strong>$500 max risk per trade</strong>
                    </p>
                  </div>
                  <div className="bg-danger/10 border border-danger/30 rounded p-4">
                    <p className="font-semibold text-danger-foreground">🚫 Never exceed 2%</p>
                    <p className="text-sm mt-2">
                      Higher risk = faster account blowup. Even with 2% risk, 10 consecutive losses = -20% drawdown.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Why it matters:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Preserves capital through losing streaks</li>
                      <li>Losing streaks are inevitable in trading</li>
                      <li>Math: With 1% risk, you can survive 50+ losses</li>
                      <li>Professional traders rarely exceed 1-2%</li>
                    </ul>
                  </div>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={risk.riskPct * 100}
            onChange={(e) => updateRisk({ riskPct: Number(e.target.value) / 100 })}
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            min="0.1"
            max="5"
            step="0.1"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          = <strong className="text-foreground">{formatCurrency(riskAmount)}</strong> per trade
        </div>
      </div>

      {/* Max Position Size */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            Max Position Size (%)
            <HelpTooltip
              short="Max account % allocated to one position"
              title="Max Position Size"
              content={
                <div className="space-y-4">
                  <p>
                    Prevents over-concentration in a single stock. Typical range: <strong>40-60%</strong>.
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Example:</h4>
                    <p className="text-sm">
                      $50,000 account × 60% = <strong>$30,000 max per position</strong>
                    </p>
                    <p className="text-sm mt-2">
                      If your risk calculation says buy 200 shares @ $200 = $40,000, 
                      you'd be capped at 150 shares ($30,000).
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Why it matters:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Diversification: Don't put all eggs in one basket</li>
                      <li>Reduces single-stock risk</li>
                      <li>Allows room for multiple positions</li>
                      <li>Prevents "bet the farm" mentality</li>
                    </ul>
                  </div>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={risk.maxPositionPct * 100}
            onChange={(e) => updateRisk({ maxPositionPct: Number(e.target.value) / 100 })}
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            min="10"
            max="100"
            step="5"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          = <strong className="text-foreground">{formatCurrency(maxPositionValue)}</strong> max per stock
        </div>
      </div>

      {/* ATR Multiplier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            ATR Multiplier (k)
            <HelpTooltip
              short="Stop distance = Entry - (k × ATR)"
              title="ATR Multiplier"
              content={
                <div className="space-y-4">
                  <p>
                    Determines how far below entry you place your stop-loss, based on the stock's volatility (ATR).
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Formula:</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      Stop = Entry - (k × ATR14)
                    </code>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Example:</h4>
                    <p className="text-sm">
                      Stock: NVDA<br />
                      Entry: $875<br />
                      ATR14: $12.10<br />
                      k = 2.0<br />
                      <strong>Stop: $875 - (2.0 × $12.10) = $850.80</strong>
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Choosing k:</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li><strong>k = 1.5:</strong> Tight stop (less risk, more whipsaws)</li>
                      <li><strong>k = 2.0:</strong> Balanced (recommended default)</li>
                      <li><strong>k = 2.5:</strong> Wider stop (more room, bigger risk)</li>
                    </ul>
                  </div>
                  <div className="bg-primary/10 border border-primary/30 rounded p-4">
                    <p className="font-semibold">💡 Why ATR-based stops?</p>
                    <p className="text-sm mt-2">
                      Adapts to each stock's personality. Volatile stocks (TSLA) get wider stops. 
                      Stable stocks (KO) get tighter stops. One-size-fits-all stops don't work.
                    </p>
                  </div>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={risk.kAtr}
            onChange={(e) => updateRisk({ kAtr: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            min="0.5"
            max="4"
            step="0.1"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          Default: 2.0 (balanced risk/reward)
        </div>
      </div>
    </div>
  );
}
