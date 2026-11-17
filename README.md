# HowMarket

> How much is it at the market today? Real prices from people near you.

## What's built (v1)

- **Sign in** — Supabase email one-time code, or demo mode with a local profile
- **Prices in my area** — every item's consensus price, per market or across your area, with a confidence badge
- **Add a price** you saw today, with a sanity nudge if it's far from what others reported
- **Item detail** — price per market, the range, the reports behind it, 👍 confirm / 🚩 flag

## How prices stay accurate

No single report sets a price. `src/lib/consensus.ts` (tested) does this for each item in each market:

1. **Recency** — only the last 14 days count; a report's weight halves every 3 days.
2. **Outlier removal** — a robust statistical test (median absolute deviation) plus a hard ½×–2× band drops typos and fake prices.
3. **Weighted median** — what's left is combined by recency × reporter trust × community votes.
4. **Confidence** — *Verified* needs 3+ different people agreeing within 3 days with a tight spread; one person posting many times still counts as one.
5. **Trust scores** — reporters whose prices match consensus gain trust; repeat outliers lose it (0.2–2).
6. **Server rules** (`supabase/schema.sql`) — row-level security, one vote per person, no self-votes, 20 reports/day limit, sane price bounds, and users can't edit their own trust.

Later (when you scale next month): photo of the price tag, location check that you're near the market, market "verifiers", and price-history charts.

## Go live

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Enable Email auth with OTP codes.
3. Copy `.env.example` to `.env` and fill in your project URL and anon key.

Without keys the app runs in **demo mode** with labelled sample prices.
## Run it

```bash
npm install          # already done once after scaffolding
npx expo start       # then press i (iOS), a (Android) or w (web)
npm run typecheck
npx expo lint
```

Built on **Expo SDK 58** (React Native 0.88, React 19.3), Expo Router, TypeScript.
Everything is stored on-device with AsyncStorage (`src/lib/storage.ts`); there is no backend yet.

## Structure

- `src/app/` — screens (Expo Router; every file is a route)
- `src/brand.ts` — app name, brand colours, screen titles
- `src/theme.ts` — light/dark design tokens
- `src/components/ui.tsx` — shared UI primitives
