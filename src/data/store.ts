/**
 * HowMarket data layer. One hook, two backends:
 *   - demo: everything in AsyncStorage, seeded with labelled sample data
 *   - supabase: real auth + shared prices (see supabase/schema.sql)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { canReport, consensus, nextTrust, type Report } from '@/lib/consensus';
import { useStoredState, uid } from '@/lib/storage';
import { isDemo, supabase } from '@/lib/supabase';
import { seedItems, seedMarkets, seedReports, type Area, type Item, type Market } from './seed';

export interface Profile {
  id: string;
  name: string;
  area: Area;
  trust: number;
}

const DAY = 86_400_000;

export function useHowMarket() {
  const [profile, setProfile, profileReady] = useStoredState<Profile | null>('profile', null);
  const [localReports, setLocalReports, reportsReady] = useStoredState<Report[]>('reports', []);
  const [votes, setVotes] = useStoredState<Record<string, 'confirm' | 'flag'>>('votes', {});
  const [remote, setRemote] = useState<{ markets: Market[]; items: Item[]; reports: Report[]; trust: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mountedAt] = useState(() => Date.now());

  // Demo: seed once
  useEffect(() => {
    if (isDemo && reportsReady && localReports.length === 0) setLocalReports(seedReports(Date.now()));
  }, [reportsReady, localReports.length, setLocalReports]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const since = new Date(Date.now() - 14 * DAY).toISOString();
    const [m, i, r, p] = await Promise.all([
      supabase.from('markets').select('id,name,area'),
      supabase.from('items').select('id,name,unit,emoji'),
      supabase.from('price_reports_with_votes').select('*').gte('created_at', since),
      supabase.from('profiles').select('id,trust'),
    ]);
    const err = m.error ?? i.error ?? r.error ?? p.error;
    if (err) return setError(err.message);
    setRemote({
      markets: m.data as Market[],
      items: i.data as Item[],
      reports: (r.data ?? []).map((x: Record<string, unknown>) => ({
        id: String(x.id),
        itemId: String(x.item_id),
        marketId: String(x.market_id),
        userId: String(x.user_id),
        price: Number(x.price),
        createdAt: Date.parse(String(x.created_at)),
        confirms: Number(x.confirms ?? 0),
        flags: Number(x.flags ?? 0),
      })),
      trust: Object.fromEntries((p.data ?? []).map((x: { id: string; trust: number }) => [x.id, x.trust])),
    });
  }, []);

  useEffect(() => {
    // Async fetch: state is only set after the network call resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isDemo && profile) refresh();
  }, [profile, refresh]);

  const markets = remote?.markets ?? seedMarkets;
  const items = remote?.items ?? seedItems;
  const reports = remote?.reports ?? localReports;
  const trustOf = useCallback(
    (userId: string) => (userId === profile?.id ? profile.trust : remote?.trust[userId] ?? 1),
    [profile, remote],
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

  const signIn = async (name: string, area: Area, email?: string) => {
    setError(null);
    if (supabase && email) {
      const { error: e } = await supabase.auth.signInWithOtp({ email, options: { data: { name, area } } });
      if (e) return setError(e.message);
      return 'check-email' as const;
    }
    setProfile({ id: uid(), name, area, trust: 1 });
    return 'signed-in' as const;
  };

  const verifyCode = async (email: string, token: string, name: string, area: Area) => {
    if (!supabase) return;
    const { data, error: e } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (e || !data.user) return setError(e?.message ?? 'Could not verify code');
    setProfile({ id: data.user.id, name, area, trust: 1 });
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    setProfile(null);
  };

  const reportsToday = profile ? reports.filter((r) => r.userId === profile.id && mountedAt - r.createdAt < DAY).length : 0;

  const addReport = async (itemId: string, marketId: string, price: number) => {
    if (!profile) return 'signed-out' as const;
    if (!canReport(reportsToday)) return 'limit' as const;
    const report: Report = { id: uid(), itemId, marketId, userId: profile.id, price, createdAt: Date.now(), confirms: 0, flags: 0 };

    // Score the reporter against the current consensus (before their own report counts)
    const before = consensus(reports.filter((r) => r.itemId === itemId && r.marketId === marketId), trustOf);
    if (before && before.reporters >= 2) setProfile({ ...profile, trust: nextTrust(profile.trust, price, before.price) });

    if (supabase) {
      const { error: e } = await supabase.from('price_reports').insert({ item_id: itemId, market_id: marketId, price });
      if (e) {
        setError(e.message);
        return 'error' as const;
      }
      await refresh();
    } else {
      setLocalReports((rs) => [...rs, report]);
    }
    return 'ok' as const;
  };

  const vote = async (reportId: string, kind: 'confirm' | 'flag') => {
    if (!profile || votes[reportId]) return;
    setVotes((v) => ({ ...v, [reportId]: kind }));
    if (supabase) {
      await supabase.from('report_votes').insert({ report_id: reportId, vote: kind === 'confirm' ? 1 : -1 });
      await refresh();
    } else {
      setLocalReports((rs) => rs.map((r) => (r.id === reportId ? { ...r, confirms: r.confirms + (kind === 'confirm' ? 1 : 0), flags: r.flags + (kind === 'flag' ? 1 : 0) } : r)));
    }
  };

  return {
    ready: profileReady && reportsReady,
    isDemo,
    error,
    profile,
    setArea: (area: Area) => profile && setProfile({ ...profile, area }),
    markets,
    areaMarkets,
    items,
    reports,
    votes,
    priceFor,
    reportsToday,
    signIn,
    verifyCode,
    signOut,
    addReport,
    vote,
    refresh,
  };
}
