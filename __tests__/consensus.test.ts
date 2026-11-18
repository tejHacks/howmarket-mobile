import { canReport, consensus, DAILY_REPORT_LIMIT, nextTrust, reportWeight, WINDOW_DAYS, type Report } from '@/lib/consensus';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 18, 12);
let n = 0;
const report = (price: number, userId = `u${n}`, ageDays = 0, extra: Partial<Report> = {}): Report => ({
  id: `r${n++}`, itemId: 'rice-50kg', marketId: 'bodija', userId, price, createdAt: NOW - ageDays * DAY, confirms: 0, flags: 0, ...extra,
});
const trust1 = () => 1;

describe('consensus', () => {
  it('returns nothing when there are no recent reports', () => {
    expect(consensus([], trust1, NOW)).toBeNull();
    expect(consensus([report(80000, 'a', WINDOW_DAYS + 1)], trust1, NOW)).toBeNull();
  });

  it('ignores zero or negative prices', () => {
    expect(consensus([report(0), report(-5)], trust1, NOW)).toBeNull();
  });

  it('a typo cannot drag the price', () => {
    const c = consensus([report(2500), report(2600), report(2450), report(25000)], trust1, NOW)!;
    expect(c.outliers.map((r) => r.price)).toEqual([25000]);
    expect(c.price).toBeGreaterThanOrEqual(2450);
    expect(c.price).toBeLessThanOrEqual(2600);
    expect(c.high).toBe(2600);
  });

  it('is Verified (high) only when 3+ different people agree recently and tightly', () => {
    const c = consensus([report(80000, 'a'), report(82000, 'b'), report(81000, 'c', 1)], trust1, NOW)!;
    expect(c.reporters).toBe(3);
    expect(c.confidence).toBe('high');
  });

  it('one person posting many times still counts as one reporter', () => {
    const c = consensus([report(80000, 'spam'), report(80000, 'spam'), report(80000, 'spam'), report(80000, 'spam')], trust1, NOW)!;
    expect(c.reporters).toBe(1);
    expect(c.confidence).toBe('low');
  });

  it('stale reports lower the confidence', () => {
    const c = consensus([report(80000, 'a', 5), report(81000, 'b', 6), report(80500, 'c', 5)], trust1, NOW)!;
    expect(c.confidence).toBe('medium');
  });

  it('newer and more trusted reports win the weighted median', () => {
    const recent = consensus([report(1000, 'a', 0), report(1400, 'b', 10)], trust1, NOW)!;
    expect(recent.price).toBe(1000);
    const trusted = consensus([report(1000, 'low'), report(1400, 'high')], (u) => (u === 'high' ? 2 : 0.2), NOW)!;
    expect(trusted.price).toBe(1400);
  });
});

describe('report weight', () => {
  it('halves every 3 days', () => {
    expect(reportWeight(report(1, 'a', 3), 1, NOW)).toBeCloseTo(0.5);
  });
  it('rises with confirms and falls with flags, but never to zero', () => {
    const base = reportWeight(report(1), 1, NOW);
    expect(reportWeight(report(1, 'a', 0, { confirms: 4 }), 1, NOW)).toBeGreaterThan(base);
    expect(reportWeight(report(1, 'a', 0, { flags: 10 }), 1, NOW)).toBeGreaterThan(0);
  });
});

describe('trust', () => {
  it('grows for accurate reporters and drops for outliers, clamped to 0.2–2', () => {
    expect(nextTrust(1, 1020, 1000)).toBeCloseTo(1.05);
    expect(nextTrust(1, 1200, 1000)).toBe(1);
    expect(nextTrust(1, 3000, 1000)).toBeCloseTo(0.85);
    expect(nextTrust(2, 1000, 1000)).toBe(2);
    expect(nextTrust(0.2, 9000, 1000)).toBe(0.2);
  });
});

it(`limits reports to ${DAILY_REPORT_LIMIT} a day`, () => {
  expect(canReport(DAILY_REPORT_LIMIT - 1)).toBe(true);
  expect(canReport(DAILY_REPORT_LIMIT)).toBe(false);
});
