import { useMemo } from 'react';

interface UseOrderRiskMetricsArgs {
  limitPrice: number;
  stopPrice: number;
  quantity: number;
  accountSize: number;
}

export function useOrderRiskMetrics({
  limitPrice,
  stopPrice,
  quantity,
  accountSize,
}: UseOrderRiskMetricsArgs) {
  return useMemo(() => {
    const positionSize = Math.max(0, limitPrice) * Math.max(0, quantity);
    const riskAmount =
      stopPrice > 0 ? (Math.max(0, limitPrice) - stopPrice) * Math.max(0, quantity) : 0;
    const accountPercent = accountSize > 0 ? (positionSize / accountSize) * 100 : 0;
    const riskPercent = accountSize > 0 ? (riskAmount / accountSize) * 100 : 0;

    return {
      positionSize,
      riskAmount,
      accountPercent,
      riskPercent,
    };
  }, [accountSize, limitPrice, quantity, stopPrice]);
}
