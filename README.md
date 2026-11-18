<p align="center">
  <img src="assets/images/icon.png" width="112" alt="HowMarket app icon" />
</p>

<h1 align="center">HowMarket</h1>

<p align="center">
  <strong>How much is it at the market today?</strong><br />
  Real food prices from people near you, checked so one bad report can't fool anyone.
</p>

<p align="center">
  <img alt="Expo SDK 58" src="https://img.shields.io/badge/Expo_SDK-58-000020?logo=expo&logoColor=white" />
  <img alt="React Native" src="https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-ready-3ECF8E?logo=supabase&logoColor=white" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-13_passing-22C55E?logo=jest&logoColor=white" />
</p>

<p align="center">
  <img src="docs/screenshots/01-prices.png" width="23%" alt="Prices in your area with confidence badges" />
  <img src="docs/screenshots/02-item.png" width="23%" alt="An item's price in each market, with the reports behind it" />
  <img src="docs/screenshots/03-add-price.png" width="23%" alt="Add a price you saw today" />
  <img src="docs/screenshots/04-login.png" width="23%" alt="Sign in and pick your area" />
</p>

---

## Why HowMarket

Food prices in Nigerian markets change week to week, and the only way to know is to go and ask. HowMarket lets shoppers share what they paid at Bodija, Oja Oba, Mile 12 or Wuse, so anyone can see today's price before leaving home. The hard part is trust, because anyone can type a wrong number. HowMarket is built so that doesn't matter.

## Features

| | |
|---|---|
| **Prices in my area** | Every item's consensus price, per market or across your whole area, with a *Verified*, *Likely* or *Unconfirmed* badge. |
| **Item detail** | The price in each market, the range, and every report behind it. Confirm 👍 a report you agree with or flag 🚩 one that looks wrong. |
| **Add a price** | Report what you saw today. If it's far from what others reported, the app asks you to double-check the amount and unit. |
| **Sign in** | Email one-time code through Supabase, or demo mode with a local profile and labelled sample prices. |

## How prices stay accurate

No single report sets a price. [`src/lib/consensus.ts`](src/lib/consensus.ts) does this for each item in each market:

1. **Recency.** Only the last 14 days count, and a report's weight halves every 3 days.
2. **Outlier removal.** A robust statistical test (median absolute deviation) plus a hard ½×–2× band drops typos and fake prices.
3. **Weighted median.** What's left is combined by recency × reporter trust × community votes.
4. **Confidence.** *Verified* needs 3+ different people agreeing within 3 days with a tight spread. One person posting many times still counts as one.
5. **Trust scores.** Reporters whose prices match consensus gain trust; repeat outliers lose it (range 0.2–2).
6. **Server rules** ([`supabase/schema.sql`](supabase/schema.sql)). Row-level security, one vote per person, no voting on your own report, 20 reports a day, sane price bounds, and nobody can edit their own trust score.

## Tech

- **Expo SDK 58** (React Native 0.88, React 19.3), Expo Router, TypeScript (strict), React Compiler
- **Supabase** for auth and shared prices; **AsyncStorage** for demo mode
- **Jest** + React Native Testing Library

```
src/
  app/          screens (Expo Router): prices, item/[id], add, login, profile
  components/   UI primitives and the confidence badge
  data/         store.ts (one hook, demo or Supabase) and seed data
  lib/          consensus.ts, storage, Supabase client
supabase/       schema.sql: tables, views, RLS and limits
__tests__/      consensus rules and app flows
```

## Getting started

```bash
npm install
npx expo start          # press i for iOS, a for Android, w for web
```

Without keys the app runs in **demo mode** with sample prices for Ibadan, Lagos and Abuja.

### Going live with Supabase

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Enable Email auth with one-time codes.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key.

### Tests

```bash
npm test                # 13 tests
npx tsc --noEmit        # typecheck
npx expo lint           # lint
```

The tests cover the consensus rules (a typo can't move the price, one person can't fake agreement, stale reports lower confidence, trust rises and falls within its limits, the daily report limit) and the sign-in → prices → search flow.

## Roadmap

- [ ] Photo of the price tag on each report
- [ ] Location check that you're near the market when you report
- [ ] Trusted market "verifiers"
- [ ] Price-history charts and price-drop alerts
- [ ] More cities and markets

## Author

Built by **Olateju Olamide Emmanuel**, mobile developer & ML engineer.
[Portfolio](https://tejusportfolio.vercel.app) · [GitHub](https://github.com/tejHacks) · [LinkedIn](https://www.linkedin.com/in/olateju-olamide-22314a292/)

## License

MIT, see [LICENSE](LICENSE).
