import { API_BASE_URL } from '@/lib/api';

export interface TickerRecurrence {
  ticker: string;
  daysSeen: number;
  streak: number;
  lastSeen: string;
}

export async function fetchScreenerRecurrence(): Promise<TickerRecurrence[]> {
  const res = await fetch(`${API_BASE_URL}/api/screener/recurrence`);
  if (!res.ok) {
    throw new Error('Failed to fetch screener recurrence');
  }
  const data = await res.json() as {
    items: Array<{ ticker: string; days_seen: number; streak: number; last_seen: string }>;
  };
  return data.items.map((r) => ({
    ticker: r.ticker,
    daysSeen: r.days_seen,
    streak: r.streak,
    lastSeen: r.last_seen,
  }));
}
