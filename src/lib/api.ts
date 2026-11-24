/**
 * HowMarket API client (Laravel backend, see github.com/tejHacks/howmarket-api).
 *
 * The server owns the rules: the daily report limit, one vote per person, no
 * voting on your own report, and trust scores. The app only displays them.
 * Other reporters arrive as anonymous ids, never as emails or database ids.
 */
import { Platform } from 'react-native';

import type { Area } from '@/data/seed';

/** EXPO_PUBLIC_API_URL wins; otherwise the local dev server (10.0.2.2 is the host Mac from the Android emulator). */
export const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8001/api' : 'http://127.0.0.1:8001/api');

const TIMEOUT_MS = 15_000;

export interface ApiProfile {
  id: string;
  name: string;
  email: string;
  area: Area;
  trust: number;
  reportsToday: number;
  dailyLimit: number;
}

export interface ApiReport {
  id: string;
  itemId: string;
  marketId: string;
  userId: string;
  price: number;
  createdAt: string;
  confirms: number;
  flags: number;
}

export interface Snapshot {
  area: Area;
  markets: { id: string; name: string; area: string }[];
  items: { id: string; name: string; unit: string; emoji: string }[];
  reports: ApiReport[];
  trust: Record<string, number>;
  myVotes: Record<string, 'confirm' | 'flag'>;
  me: ApiProfile | null;
}

export interface AuthResult {
  token: string;
  user: ApiProfile;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Only http(s) URLs; a trailing slash is dropped. */
export function normaliseServer(url: string) {
  const u = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/i.test(u)) throw new ApiError('Server address should start with http:// or https://', 0);
  return u;
}

type Options = { method?: 'GET' | 'POST' | 'PATCH'; token?: string | null; body?: unknown };

export async function request<T>(server: string, path: string, { method = 'GET', token, body }: Options = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${normaliseServer(server)}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Can't reach the HowMarket server. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(errorMessage(res.status, data), res.status);
  return data as T;
}

function errorMessage(status: number, data: unknown): string {
  const d = (data ?? {}) as { message?: string; errors?: Record<string, string[]> };
  const first = d.errors ? Object.values(d.errors)[0]?.[0] : undefined;
  if (first) return first;
  if (status === 401) return 'Please sign in again.';
  if (status === 429 && !d.message) return 'Too many tries. Wait a minute and try again.';
  return d.message || `Something went wrong (${status}).`;
}

export const api = {
  register: (server: string, body: { name: string; email: string; password: string; area: Area }) =>
    request<AuthResult>(server, '/register', { method: 'POST', body }),
  login: (server: string, body: { email: string; password: string }) => request<AuthResult>(server, '/login', { method: 'POST', body }),
  logout: (server: string, token: string) => request<{ ok: true }>(server, '/logout', { method: 'POST', token }),
  updateMe: (server: string, token: string, body: { name?: string; area?: Area }) =>
    request<ApiProfile>(server, '/me', { method: 'PATCH', token, body }),
  snapshot: (server: string, area: Area, token?: string | null) =>
    request<Snapshot>(server, `/snapshot?area=${encodeURIComponent(area)}`, { token }),
  report: (server: string, token: string, body: { item_id: string; market_id: string; price: number }) =>
    request<{ report: { id: string }; me: ApiProfile }>(server, '/reports', { method: 'POST', token, body }),
  vote: (server: string, token: string, reportId: string, vote: 'confirm' | 'flag') =>
    request<{ ok: true }>(server, `/reports/${encodeURIComponent(reportId)}/vote`, { method: 'POST', token, body: { vote } }),
};
