/**
 * Price consensus — how HowMarket keeps prices honest.
 *
 * Nobody's single report "sets" a price. For each item in each market:
 *   1. Only recent reports count (last WINDOW_DAYS), and newer ones count more.
 *   2. Reports are weighted by the reporter's trust score, and community votes
 *      (confirm / looks wrong) adjust each report's weight.
 *   3. Outliers are dropped with a robust test (median absolute deviation), so a
 *      typo like ₦25,000 for a ₦2,500 item can't drag the price.
 *   4. The published price is the weighted median of what's left.
 *   5. Confidence depends on how many *different people* agree, how fresh the
 *      reports are, and how tight the spread is.
 *   6. Reporters whose prices land near consensus gain trust; repeat outliers lose it.
 *
 * Pure functions only — the same logic is mirrored server-side in supabase/schema.sql.
 */

export const WINDOW_DAYS = 14;
const HALF_LIFE_DAYS = 3;
const DAY = 86_400_000;

export interface Report {
  id: string;
  itemId: string;
  marketId: string;
  userId: string;
  price: number;
  createdAt: number;
  confirms: number;
  flags: number;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface Consensus {
  price: number;
  low: number;
  high: number;
  confidence: Confidence;
  reporters: number;
  used: Report[];
  outliers: Report[];
  updatedAt: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function weightedMedian(points: { value: number; weight: number }[]) {
  const s = [...points].sort((a, b) => a.value - b.value);
  const total = s.reduce((t, p) => t + p.weight, 0);
  let acc = 0;
  for (const p of s) {
    acc += p.weight;
    if (acc >= total / 2) return p.value;
  }
  return s[s.length - 1].value;
}

/** Weight of a single report: recency × reporter trust × community votes. */
export function reportWeight(r: Report, trust: number, now: number) {
  const ageDays = (now - r.createdAt) / DAY;
  const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  const votes = Math.max(0.1, 1 + 0.25 * r.confirms - 0.5 * r.flags);
  return recency * Math.max(0.1, trust) * votes;
}

/** Robust outlier test: modified z-score from the median absolute deviation. */
function splitOutliers(reports: Report[]) {
  const m = median(reports.map((r) => r.price));
  const mad = median(reports.map((r) => Math.abs(r.price - m))) || m * 0.05; // floor for identical prices
  const used: Report[] = [];
  const outliers: Report[] = [];
  for (const r of reports) {
    const z = (0.6745 * Math.abs(r.price - m)) / mad;
    // also reject anything more than 2× or under ½ the median outright
    if (z > 3.5 || r.price > m * 2 || r.price < m / 2) outliers.push(r);
    else used.push(r);
  }
  return { used, outliers };
}

export function consensus(reports: Report[], trustOf: (userId: string) => number, now = Date.now()): Consensus | null {
  const recent = reports.filter((r) => now - r.createdAt <= WINDOW_DAYS * DAY && r.price > 0);
  if (recent.length === 0) return null;

  const { used, outliers } = recent.length >= 3 ? splitOutliers(recent) : { used: recent, outliers: [] as Report[] };
  const price = weightedMedian(used.map((r) => ({ value: r.price, weight: reportWeight(r, trustOf(r.userId), now) })));
  const prices = used.map((r) => r.price);
  const reporters = new Set(used.map((r) => r.userId)).size;
  const newest = Math.max(...used.map((r) => r.createdAt));
  const spread = (Math.max(...prices) - Math.min(...prices)) / price;
  const fresh = now - newest <= 3 * DAY;

  const confidence: Confidence =
    reporters >= 3 && fresh && spread <= 0.25 ? 'high' : reporters >= 2 && spread <= 0.5 ? 'medium' : 'low';

  return { price: Math.round(price), low: Math.min(...prices), high: Math.max(...prices), confidence, reporters, used, outliers, updatedAt: newest };
}

/**
 * Trust update after a report is scored against consensus: close to the
 * consensus → trust grows; an outlier → trust drops. Clamped to 0.2–2.
 */
export function nextTrust(trust: number, reportPrice: number, consensusPrice: number) {
  const err = Math.abs(reportPrice - consensusPrice) / consensusPrice;
  const delta = err <= 0.1 ? 0.05 : err <= 0.25 ? 0 : err <= 0.5 ? -0.05 : -0.15;
  return Math.min(2, Math.max(0.2, trust + delta));
}

/** Simple abuse guard: max reports per user per day. */
export const DAILY_REPORT_LIMIT = 20;
export function canReport(userReportsToday: number) {
  return userReportsToday < DAILY_REPORT_LIMIT;
}
