import { useConfigStore } from '@/stores/configStore';
import HelpTooltip from '@/components/common/HelpTooltip';

export default function ManageConfigForm() {
  const { config, updateManage } = useConfigStore();
  const { manage } = config;

  return (
    <div className="space-y-6">
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-6">
        <p className="text-sm font-semibold">These rules protect profits and limit losses on open positions.</p>
      </div>

      {/* Breakeven at R */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            Move Stop to Breakeven At
            <HelpTooltip
              short="When profit reaches this R, move stop to entry"
              title="Breakeven Rule"
              content={
                <div className="space-y-4">
                  <p>
                    When your position reaches +1R profit, automatically suggest moving the stop to your entry price.
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Why +1R?</h4>
                    <p className="text-sm">
                      At +1R, you've made back your initial risk. Moving stop to entry locks in a "no-lose" trade. 
                      If the trade reverses, you exit at breakeven (no loss).
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Example:</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      Entry: $100, Stop: $95, 1R = $5<br />
                      Current: $105 → R = +1.0<br />
                      → Move stop from $95 to $100
                    </code>
                  </div>
                  <div className="bg-success/10 border border-success/30 rounded p-4">
                    <p className="font-semibold text-success-foreground">✅ Golden Rule</p>
                    <p className="text-sm mt-2">
                      Never let a winner become a loser. Once at +1R, worst case is breakeven.
                    </p>
                  </div>
                </div>
              }
            />
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={manage.breakevenAtR}
              onChange={(e) => updateManage({ breakevenAtR: Number(e.target.value) })}
              className="w-32 px-4 py-2 border border-border rounded-lg"
              min="0.5"
              max="2"
              step="0.1"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">R</span>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          Default: 1.0R (lock in breakeven after 1× initial risk gain)
        </div>
      </div>

      {/* Trail After R */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            Start Trailing Stop After
            <HelpTooltip
              short="After this R, trail stop below SMA"
              title="Trailing Stop Activation"
              content={
                <div className="space-y-4">
                  <p>
                    After reaching +2R, switch from breakeven stop to a trailing stop that follows SMA20.
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Why +2R?</h4>
                    <p className="text-sm">
                      At +2R, you've locked in breakeven (+1R). Now we want to "let winners run" 
                      while protecting downside. Trailing below SMA20 gives the stock room to breathe.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">How it works:</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      New Stop = SMA20 × (1 - buffer%)<br />
                      Updates daily as SMA20 rises
                    </code>
                  </div>
                  <div className="bg-primary/10 border border-primary/30 rounded p-4">
                    <p className="font-semibold">💡 Let winners run</p>
                    <p className="text-sm mt-2">
                      Your big winners (+5R, +10R) come from letting good trades run. 
                      Trailing stops protect gains without cutting profits short.
                    </p>
                  </div>
                </div>
              }
            />
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={manage.trailAfterR}
              onChange={(e) => updateManage({ trailAfterR: Number(e.target.value) })}
              className="w-32 px-4 py-2 border border-border rounded-lg"
              min="1"
              max="5"
              step="0.5"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">R</span>
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          Default: 2.0R (start trailing after 2× initial risk)
        </div>
      </div>

      {/* Trail SMA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            Trail Below SMA
            <HelpTooltip
              short="SMA period for trailing stop reference"
              title="Trailing SMA Period"
              content={
                <div className="space-y-4">
                  <p>
                    Which moving average to use as the trailing stop reference. Default: SMA20.
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Why SMA20?</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Tracks short-term trend (~1 month)</li>
                      <li>Not too tight (less whipsaws)</li>
                      <li>Not too loose (protects profits)</li>
                      <li>Widely used standard</li>
                    </ul>
                  </div>
                  <p className="text-sm">
                    Some traders use SMA10 (tighter) or SMA50 (looser). Experiment to find what works for you.
                  </p>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={manage.trailSma}
            onChange={(e) => updateManage({ trailSma: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-border rounded-lg"
            min="5"
            max="50"
          />
        </div>
      </div>

      {/* SMA Buffer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            SMA Buffer (%)
            <HelpTooltip
              short="Safety buffer below SMA (prevents false stops)"
              title="SMA Buffer Percentage"
              content={
                <div className="space-y-4">
                  <p>
                    Small buffer below the SMA to avoid getting stopped on minor dips below the moving average.
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Formula:</h4>
                    <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-sm">
                      Stop = SMA20 × (1 - buffer%)
                    </code>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Example:</h4>
                    <p className="text-sm">
                      SMA20 = $108<br />
                      Buffer = 0.5%<br />
                      <strong>Stop = $108 × 0.995 = $107.46</strong>
                    </p>
                  </div>
                  <p className="text-sm">
                    Typical: 0.5%. Too tight → whipsaws. Too wide → gives back too much profit.
                  </p>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={manage.smaBufferPct * 100}
            onChange={(e) => updateManage({ smaBufferPct: Number(e.target.value) / 100 })}
            className="w-full px-4 py-2 border border-border rounded-lg"
            min="0"
            max="2"
            step="0.1"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          Default: 0.5% (small safety cushion)
        </div>
      </div>

      {/* Max Holding Days */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            Max Holding Period (bars)
            <HelpTooltip
              short="Exit if position held longer than this many trading days"
              title="Time-Based Exit"
              content={
                <div className="space-y-4">
                  <p>
                    Automatically suggest closing positions held longer than this many trading days (bars).
                  </p>
                  <div>
                    <h4 className="font-semibold mb-2">Why time exits?</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>"Dead money" - capital not working</li>
                      <li>Swing trades should move within weeks</li>
                      <li>If nothing's happening, find better opportunities</li>
                      <li>Frees up capital for fresh ideas</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Typical Range:</h4>
                    <p className="text-sm">
                      15-30 trading days (3-6 weeks). Default: 20 bars.
                    </p>
                  </div>
                  <div className="bg-warning/10 border border-warning/30 rounded p-4">
                    <p className="font-semibold text-warning-foreground">⚠️ Note</p>
                    <p className="text-sm mt-2">
                      This is a suggestion, not automatic. Review why the trade stalled before closing.
                    </p>
                  </div>
                </div>
              }
            />
          </label>
          <input
            type="number"
            value={manage.maxHoldingDays}
            onChange={(e) => updateManage({ maxHoldingDays: Number(e.target.value) })}
            className="w-full px-4 py-2 border border-border rounded-lg"
            min="5"
            max="60"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 pt-8">
          Default: 20 bars (~4 weeks for daily charts)
        </div>
      </div>
    </div>
  );
}
