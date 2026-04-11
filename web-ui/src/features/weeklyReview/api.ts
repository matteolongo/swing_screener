import axios from 'axios';
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

export async function fetchWeeklyReviews(): Promise<WeeklyReview[]> {
  const res = await axios.get<WeeklyReview[]>(base());
  return res.data;
}

export async function fetchWeeklyReview(weekId: string): Promise<WeeklyReview> {
  const res = await axios.get<WeeklyReview>(`${base()}/${encodeURIComponent(weekId)}`);
  return res.data;
}

export async function upsertWeeklyReview(weekId: string, request: WeeklyReviewUpsertRequest): Promise<WeeklyReview> {
  const res = await axios.put<WeeklyReview>(`${base()}/${encodeURIComponent(weekId)}`, request);
  return res.data;
}
