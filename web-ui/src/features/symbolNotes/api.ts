import axios from 'axios';
import { API_BASE_URL } from '@/lib/api';

export interface SymbolNote {
  ticker: string;
  note: string | null;
  updated_at: string | null;
}

const base = () => `${API_BASE_URL}/api/symbol-notes`;

export async function fetchSymbolNotes(): Promise<SymbolNote[]> {
  const res = await axios.get<SymbolNote[]>(base());
  return res.data;
}

export async function fetchSymbolNote(ticker: string): Promise<SymbolNote> {
  const res = await axios.get<SymbolNote>(`${base()}/${encodeURIComponent(ticker)}`);
  return res.data;
}

export async function upsertSymbolNote(ticker: string, note: string): Promise<SymbolNote> {
  const res = await axios.put<SymbolNote>(`${base()}/${encodeURIComponent(ticker)}`, { note });
  return res.data;
}

export async function deleteSymbolNote(ticker: string): Promise<{ deleted: boolean }> {
  const res = await axios.delete<{ deleted: boolean }>(`${base()}/${encodeURIComponent(ticker)}`);
  return res.data;
}
