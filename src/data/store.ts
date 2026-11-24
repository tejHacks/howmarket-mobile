/**
 * HowMarket data layer. One hook, two modes, chosen at sign-in:
 *   - demo: everything in AsyncStorage on this phone, seeded with labelled sample prices
 *   - live: a HowMarket account on the Laravel API (src/lib/api.ts). The server
 *     enforces the daily limit, votes and trust; the last snapshot is cached so
 *     prices still show offline.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api, ApiError, DEFAULT_API_URL, type ApiProfile, type Snapshot } from '@/lib/api';
import { canReport, consensus, nextTrust, type Report } from '@/lib/consensus';
import { useStoredState, uid } from '@/lib/storage';
import { clearToken, getToken, setToken } from '@/lib/token';
import { seedItems, seedMarkets, seedReports, type Area } from './seed';

export interface Profile {
  id: string;
  name: string;
  area: Area;
  trust: number;
  /** Missing on profiles saved before accounts existed: those are demo profiles. */
  mode?: 'demo' | 'live';
  email?: string;
  server?: string;
  reportsToday?: number;
}

const DAY = 86_400_000;

// Several screens use the hook at once; share one request per area instead of one each.
const inflight = new Map<string, Promise<Snapshot>>();

const fromApi = (me: ApiProfile, server: string): Profile => ({
  id: me.id,
  name: me.name,
  area: me.area,
  trust: me.trust,
  email: me.email,
  reportsToday: me.reportsToday,
  mode: 'live',
  server,
});

export function useHowMarket() {
  const [profile, setProfile, profileReady] = useStoredState<Profile | null>('profile', null);
  const [localReports, setLocalReports, reportsReady] = useStoredState<Report[]>('reports', []);
  const [localVotes, setLocalVotes] = useStoredState<Record<string, 'confirm' | 'flag'>>('votes', {});
  const [snapshot, setSnapshot] = useStoredState<Snapshot | null>('live-snapshot', null);
  const [error, setError] = useState<string | null>(null);
  const [mountedAt] = useState(() => Date.now());

  const live = profile?.mode === 'live';
  const server = profile?.server ?? DEFAULT_API_URL;

  // Demo: seed once
  useEffect(() => {
    if (profileReady && reportsReady && !live && localReports.length === 0) setLocalReports(seedReports(Date.now()));
  }, [profileReady, reportsReady, live, localReports.length, setLocalReports]);

  /** A revoked or expired token: drop the account on this phone and ask to sign in again. */
  const handleAuthError = useCallback(
    async (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        setSnapshot(null);
        setProfile(null);
      }
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    },
    [setProfile, setSnapshot],
  );

  const refresh = useCallback(async () => {
    if (!live || !profile) return;
    const key = `${server}|${profile.area}`;
    try {
      let p = inflight.get(key);
      if (!p) {
        p = getToken().then((token) => api.snapshot(server, profile.area, token));
        inflight.set(key, p);
        p.finally(() => inflight.delete(key)).catch(() => {});
      }
      const snap = await p;
      setSnapshot(snap);
      if (snap.me) setProfile((prev) => (prev?.mode === 'live' ? { ...prev, ...fromApi(snap.me!, prev.server ?? server) } : prev));
      setError(null);
    } catch (e) {
      await handleAuthError(e);
    }
  }, [live, profile, server, setSnapshot, setProfile, handleAuthError]);

  useEffect(() => {
    // Async fetch: state is only set after the network call resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (live) refresh();
    // Refetch when the account or area changes, not on every profile update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, profile?.area, profile?.id]);

  const liveData = live && snapshot?.area === profile?.area ? snapshot : null;
  const markets = liveData?.markets ?? seedMarkets;
  const items = liveData?.items ?? seedItems;
  const reports: Report[] = useMemo(
    () => (live ? (liveData?.reports ?? []).map((r) => ({ ...r, createdAt: Date.parse(r.createdAt) })) : localReports),
    [live, liveData, localReports],
  );
  const votes = live ? (liveData?.myVotes ?? {}) : localVotes;

  const trustOf = useCallback(
    (userId: string) => (userId === profile?.id ? profile.trust : (liveData?.trust[userId] ?? 1)),
    [profile, liveData],
  );

  const areaMarkets = useMemo(() => markets.filter((m) => m.area === profile?.area), [markets, profile?.area]);

  /** Consensus price for an item in one market (or across all markets in the area). */
  const priceFor = useCallback(
    (itemId: string, marketId?: string) =>
      consensus(
        reports.filter((r) => r.itemId === itemId && (marketId ? r.marketId === marketId : areaMarkets.some((m) => m.id === r.marketId))),
        trustOf,
      ),
    [reports, trustOf, areaMarkets],
  );

  /** Demo mode: a local profile, no account. */
  const signIn = async (name: string, area: Area) => {
    setError(null);
    setProfile({ id: uid(), name, area, trust: 1, mode: 'demo' });
    return 'signed-in' as const;
  };

  /** Live mode: create an account or sign in to one. The token goes to secure storage. */
  const signInLive = async (
    kind: 'login' | 'register',
    form: { email: string; password: string; name?: string; area?: Area },
    serverUrl = DEFAULT_API_URL,
  ) => {
    setError(null);
    try {
      const res =
        kind === 'register'
          ? await api.register(serverUrl, { name: form.name ?? '', email: form.email, password: form.password, area: form.area ?? 'Ibadan' })
          : await api.login(serverUrl, { email: form.email, password: form.password });
      await setToken(res.token);
      setSnapshot(null);
      setProfile(fromApi(res.user, serverUrl));
      return 'signed-in' as const;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
      return 'error' as const;
    }
  };

  const signOut = async () => {
    if (live) {
      const token = await getToken();
      if (token) await api.logout(server, token).catch(() => {});
      await clearToken();
      setSnapshot(null);
    }
    setProfile(null);
  };

  const setArea = async (area: Area) => {
    if (!profile) return;
    if (!live) return setProfile({ ...profile, area });
    try {
      const token = await getToken();
      if (!token) throw new ApiError('Please sign in again.', 401);
      setProfile(fromApi(await api.updateMe(server, token, { area }), server));
    } catch (e) {
      await handleAuthError(e);
    }
  };

  const reportsToday = !profile
    ? 0
    : live
      ? (profile.reportsToday ?? 0)
      : reports.filter((r) => r.userId === profile.id && mountedAt - r.createdAt < DAY).length;

  const addReport = async (itemId: string, marketId: string, price: number) => {
    if (!profile) return 'signed-out' as const;
    setError(null);

    if (live) {
      try {
        const token = await getToken();
        if (!token) throw new ApiError('Please sign in again.', 401);
        const res = await api.report(server, token, { item_id: itemId, market_id: marketId, price });
        setProfile(fromApi(res.me, server));
        await refresh();
        return 'ok' as const;
      } catch (e) {
        if (e instanceof ApiError && e.status === 429) return 'limit' as const;
        await handleAuthError(e);
        return 'error' as const;
      }
    }

    if (!canReport(reportsToday)) return 'limit' as const;
    // Score the reporter against the current consensus (before their own report counts)
    const before = consensus(reports.filter((r) => r.itemId === itemId && r.marketId === marketId), trustOf);
    if (before && before.reporters >= 2) setProfile({ ...profile, trust: nextTrust(profile.trust, price, before.price) });
    setLocalReports((rs) => [...rs, { id: uid(), itemId, marketId, userId: profile.id, price, createdAt: Date.now(), confirms: 0, flags: 0 }]);
    return 'ok' as const;
  };

  const vote = async (reportId: string, kind: 'confirm' | 'flag') => {
    if (!profile || votes[reportId]) return;

    if (live) {
      try {
        const token = await getToken();
        if (!token) throw new ApiError('Please sign in again.', 401);
        await api.vote(server, token, reportId, kind);
      } catch (e) {
        // 409: already voted (e.g. on another phone). The refresh below shows it.
        if (!(e instanceof ApiError && e.status === 409)) await handleAuthError(e);
      }
      await refresh();
      return;
    }

    setLocalVotes((v) => ({ ...v, [reportId]: kind }));
    setLocalReports((rs) => rs.map((r) => (r.id === reportId ? { ...r, confirms: r.confirms + (kind === 'confirm' ? 1 : 0), flags: r.flags + (kind === 'flag' ? 1 : 0) } : r)));
  };

  return {
    ready: profileReady && reportsReady,
    isDemo: !live,
    error,
    profile,
    setArea,
    markets,
    areaMarkets,
    items,
    reports,
    votes,
    priceFor,
    reportsToday,
    signIn,
    signInLive,
    signOut,
    addReport,
    vote,
    refresh,
  };
}
