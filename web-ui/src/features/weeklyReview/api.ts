import { API_BASE_URL } from '@/lib/api';

export interface WeeklyReview {
  week_id: string;
  what_worked: string;
  what_didnt: string;
  rules_violated: string;
  next_week_focus: string;
  updated_at: string;
}

export interface WeeklyReviewUpsertRequest {
  what_worked: string;
  what_didnt: string;
  rules_violated: string;
  next_week_focus: string;
}

const base = () => `${API_BASE_URL}/api/weekly-reviews`;

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }
  return response.json() as Promise<T>;
}

export async function fetchWeeklyReviews(): Promise<WeeklyReview[]> {
  const res = await fetch(base());
  return parseJsonResponse<WeeklyReview[]>(res, 'Failed to fetch weekly reviews');
}

export async function fetchWeeklyReview(weekId: string): Promise<WeeklyReview> {
  const res = await fetch(`${base()}/${encodeURIComponent(weekId)}`);
  return parseJsonResponse<WeeklyReview>(res, 'Failed to fetch weekly review');
}

export async function upsertWeeklyReview(weekId: string, request: WeeklyReviewUpsertRequest): Promise<WeeklyReview> {
  const res = await fetch(`${base()}/${encodeURIComponent(weekId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return parseJsonResponse<WeeklyReview>(res, 'Failed to save weekly review');
}
