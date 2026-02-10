import { Position } from '@/features/portfolio/types';

export function calcTotalPositionValue(positions: Position[]): number {
  return positions.reduce((sum, pos) => sum + (pos.entryPrice * pos.shares), 0);
}

export function calcOpenRisk(positions: Position[]): number {
  return positions.reduce((sum, pos) => {
    const perShareRisk = pos.initialRisk && pos.initialRisk > 0
      ? pos.initialRisk
      : pos.entryPrice - pos.stopPrice;
    if (perShareRisk <= 0) return sum;
    return sum + (perShareRisk * pos.shares);
  }, 0);
}

export function calcOpenRiskPct(openRisk: number, accountSize: number): number {
  if (!accountSize || accountSize <= 0) return 0;
  return openRisk / accountSize;
}
