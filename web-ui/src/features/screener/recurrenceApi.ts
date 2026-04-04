import axios from 'axios';
import { API_BASE_URL } from '@/lib/api';

export interface TickerRecurrence {
  ticker: string;
  daysSeen: number;
  streak: number;
  lastSeen: string;
}

export async function fetchScreenerRecurrence(): Promise<TickerRecurrence[]> {
  const res = await axios.get<{ items: Array<{ ticker: string; days_seen: number; streak: number; last_seen: string }> }>(
    `${API_BASE_URL}/api/screener/recurrence`
  );
  return res.data.items.map((r) => ({
    ticker: r.ticker,
    daysSeen: r.days_seen,
    streak: r.streak,
    lastSeen: r.last_seen,
  }));
}
