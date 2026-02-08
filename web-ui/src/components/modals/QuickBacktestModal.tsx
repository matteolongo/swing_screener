import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, TrendingUp, TrendingDown, AlertCircle, BarChart3 } from 'lucide-react';
import Button from '../common/Button';
import { apiUrl } from '../../lib/api';
import { QuickBacktestResponseAPI, transformQuickBacktestResponse, QuickBacktestResponse } from '../../types/backtest';
import { formatR, formatPercent, formatCurrency } from '../../utils/formatters';
import { useConfigStore } from '../../stores/configStore';

interface QuickBacktestModalProps {
  ticker: string;
  onClose: () => void;
}

export default function QuickBacktestModal({ ticker, onClose }: QuickBacktestModalProps) {
  const { config } = useConfigStore();
  const [monthsBack, setMonthsBack] = useState(12);
  const [result, setResult] = useState<QuickBacktestResponse | null>(null);

  const backtestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(apiUrl('/api/backtest/quick'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          months_back: monthsBack,
          k_atr: config.risk.kAtr,
          max_holding_days: 20,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Backtest failed');
      }
      
      const data: QuickBacktestResponseAPI = await response.json();
      return transformQuickBacktestResponse(data);
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const summary = result?.summary;
  const isPositive = summary && summary.expectancy_R > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <BarChart3 className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold">Quick Backtest - {ticker}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Lookback Period</label>
            <select
              value={monthsBack}
              onChange={(e) => setMonthsBack(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={backtestMutation.isPending}
            >
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
            </select>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
            <div>Using: Stop {config.risk.kAtr}× ATR, Max 20 days</div>
          </div>

          {!result && (
            <Button onClick={() => backtestMutation.mutate()} disabled={backtestMutation.isPending} className="w-full">
              {backtestMutation.isPending ? 'Running...' : 'Run Backtest'}
            </Button>
          )}

          {backtestMutation.isError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
              Error: {backtestMutation.error.message}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {result.warnings.map((w, i) => (
                <div key={i} className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 flex">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Period</div>
                  <div className="font-semibold">{result.start} → {result.end}</div>
                  <div className="text-xs text-gray-500">{result.bars} bars</div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Trades</div>
                  <div className="text-xl font-semibold">{result.trades}</div>
                </div>

                <div className={`p-3 rounded ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="text-xs text-gray-600">Expectancy</div>
                  <div className={`text-xl font-bold flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? <TrendingUp className="w-5 h-5 mr-1" /> : <TrendingDown className="w-5 h-5 mr-1" />}
                    {formatR(summary.expectancy_R)}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Win Rate</div>
                  <div className="text-xl font-bold">{formatPercent(summary.winrate * 100)}</div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Profit Factor</div>
                  <div className="text-lg font-semibold">{summary.profit_factor_R.toFixed(2)}</div>
                </div>

                <div className="p-3 bg-red-50 rounded">
                  <div className="text-xs text-gray-600">Max Drawdown</div>
                  <div className="text-lg font-semibold text-red-600">{formatR(summary.max_drawdown_R)}</div>
                </div>
              </div>

              {result.trades_detail.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium hover:text-blue-600">
                    Show {result.trades_detail.length} Trades
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {result.trades_detail.map((t, i) => (
                      <div key={i} className="py-1 border-b text-xs flex justify-between">
                        <span>{t.entry_date}</span>
                        <span className={t.R >= 0 ? 'text-green-600' : 'text-red-600'}>{formatR(t.R)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setResult(null)} className="flex-1">
                  Run Again
                </Button>
                <Button onClick={onClose} className="flex-1">Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
