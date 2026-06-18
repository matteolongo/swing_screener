import { fetchJson } from '@/lib/fetchJson';

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

const base = () => `/api/weekly-reviews`;

export async function fetchWeeklyReviews(): Promise<WeeklyReview[]> {
  return fetchJson<WeeklyReview[]>(base(), { errorMessage: 'Failed to fetch weekly reviews' });
}

export async function fetchWeeklyReview(weekId: string): Promise<WeeklyReview> {
  return fetchJson<WeeklyReview>(`${base()}/${encodeURIComponent(weekId)}`, {
    errorMessage: 'Failed to fetch weekly review',
  });
}

export async function upsertWeeklyReview(weekId: string, request: WeeklyReviewUpsertRequest): Promise<WeeklyReview> {
  return fetchJson<WeeklyReview>(`${base()}/${encodeURIComponent(weekId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    errorMessage: 'Failed to save weekly review',
  });
}
