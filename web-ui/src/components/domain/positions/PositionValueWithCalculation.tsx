import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Info } from 'lucide-react';
import { useState } from 'react';

interface PositionValueWithCalculationProps {
  shares: number;
  currentPrice: number;
  entryPrice: number;
  entryValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  isProfitable: boolean;
  showInline?: boolean;
  showTooltip?: boolean;
}

export default function PositionValueWithCalculation({
  shares,
  currentPrice,
  entryPrice,
  entryValue,
  currentValue,
  pnl,
  pnlPercent,
  isProfitable,
  showInline = true,
  showTooltip = true,
}: PositionValueWithCalculationProps) {
  const [showCalculation, setShowCalculation] = useState(false);

  const colorClass = isProfitable
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="relative">
      <div className={`font-semibold ${colorClass} flex items-center gap-2`}>
        <span>{formatCurrency(currentValue)}</span>
        {showTooltip && (
          <button
            onMouseEnter={() => setShowCalculation(true)}
            onMouseLeave={() => setShowCalculation(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Show calculation"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      
      {showInline && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {shares} × {formatCurrency(currentPrice)}
        </div>
      )}

      {showTooltip && showCalculation && (
        <div className="absolute z-10 left-0 top-full mt-1 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg p-3 shadow-lg w-64 border border-gray-700">
          <div className="font-semibold mb-2">Calculation Details</div>
          <div className="space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-gray-300">Entry:</span>
              <span>
                {shares} shares × {formatCurrency(entryPrice)} = {formatCurrency(entryValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Current:</span>
              <span>
                {shares} shares × {formatCurrency(currentPrice)} = {formatCurrency(currentValue)}
              </span>
            </div>
            <div className="border-t border-gray-700 pt-1.5 mt-1.5 flex justify-between font-semibold">
              <span className="text-gray-300">P&L:</span>
              <span className={isProfitable ? 'text-green-400' : 'text-red-400'}>
                {formatCurrency(currentValue)} - {formatCurrency(entryValue)} = {isProfitable ? '+' : ''}
                {formatCurrency(pnl)} ({formatPercent(pnlPercent)})
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-400">
            💡 Tip: Compare these values with your broker to verify calculations
          </div>
        </div>
      )}
    </div>
  );
}
