/**
 * SAMPLE DATA for demo mode only — markets and items are real places/goods,
 * but every price below is a placeholder, not a real quote.
 */
import type { Report } from '@/lib/consensus';

export interface Market {
  id: string;
  name: string;
  area: string;
}

export interface Item {
  id: string;
  name: string;
  unit: string;
  emoji: string;
}

export const AREAS = ['Ibadan', 'Lagos', 'Abuja'] as const;
export type Area = (typeof AREAS)[number];

export const seedMarkets: Market[] = [
  { id: 'bodija', name: 'Bodija Market', area: 'Ibadan' },
  { id: 'oja-oba', name: 'Oja Oba', area: 'Ibadan' },
  { id: 'dugbe', name: 'Dugbe Market', area: 'Ibadan' },
  { id: 'mile12', name: 'Mile 12 Market', area: 'Lagos' },
  { id: 'oyingbo', name: 'Oyingbo Market', area: 'Lagos' },
  { id: 'wuse', name: 'Wuse Market', area: 'Abuja' },
];

export const seedItems: Item[] = [
  { id: 'rice-50kg', name: 'Rice', unit: '50kg bag', emoji: '🍚' },
  { id: 'garri-paint', name: 'Garri (white)', unit: 'paint bucket', emoji: '🥣' },
  { id: 'beans-paint', name: 'Beans (oloyin)', unit: 'paint bucket', emoji: '🫘' },
  { id: 'tomato-basket', name: 'Tomatoes', unit: 'big basket', emoji: '🍅' },
  { id: 'palm-oil-25l', name: 'Palm oil', unit: '25 litres', emoji: '🛢️' },
  { id: 'yam-tuber', name: 'Yam', unit: 'medium tuber', emoji: '🍠' },
  { id: 'eggs-crate', name: 'Eggs', unit: 'crate (30)', emoji: '🥚' },
  { id: 'onions-bag', name: 'Onions', unit: 'small bag', emoji: '🧅' },
];

/** Placeholder base prices (₦) used to generate demo reports. */
const base: Record<string, number> = {
  'rice-50kg': 80000,
  'garri-paint': 6000,
  'beans-paint': 9500,
  'tomato-basket': 45000,
  'palm-oil-25l': 52000,
  'yam-tuber': 2500,
  'eggs-crate': 5500,
  'onions-bag': 18000,
};

/** Deterministic pseudo-random so demo data is stable between launches. */
function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function seedReports(now: number): Report[] {
  const out: Report[] = [];
  let k = 1;
  seedMarkets.forEach((m, mi) => {
    seedItems.forEach((it, ii) => {
      const reports = 2 + Math.floor(rand(k++) * 4);
      for (let i = 0; i < reports; i++) {
        const drift = 1 + (rand(k++) - 0.5) * 0.16 + mi * 0.02;
        out.push({
          id: `seed-${m.id}-${it.id}-${i}`,
          itemId: it.id,
          marketId: m.id,
          userId: `neighbour-${Math.floor(rand(k++) * 6)}`,
          price: Math.round((base[it.id] * drift) / 50) * 50,
          createdAt: now - Math.floor(rand(k++) * 9) * 86_400_000 - ii * 3_600_000,
          confirms: Math.floor(rand(k++) * 3),
          flags: 0,
        });
      }
      // one typo-style outlier per few items, to show the filter working
      if ((mi + ii) % 5 === 0) {
        out.push({ id: `seed-${m.id}-${it.id}-typo`, itemId: it.id, marketId: m.id, userId: 'neighbour-9', price: base[it.id] * 10, createdAt: now - 86_400_000, confirms: 0, flags: 2 });
      }
    });
  });
  return out;
}

export const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;
