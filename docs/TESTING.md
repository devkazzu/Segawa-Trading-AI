# Testing

```bash
npm test             # vitest, 7 suites / 103 tests
npm run typecheck    # tsc project build, strict + noUnusedLocals
```

## Suites

| File | Covers |
|---|---|
| `src/test/calc.test.ts` (26) | Tick-based P&L long/short, forex precision, cost deduction, open-trade handling, risk, R-multiples, planned R:R, win rate, profit factor, expectancy, averages, equity curve, drawdown, streaks, grouping, monthly aggregation, calendar grid, date ranges |
| `src/test/risk.test.ts` (10) | Position sizing (gold + forex, percent + fixed), invalid-input rejection, linear scaling, daily-loss breach, streak alert, healthy state, drawdown %, trade quality score |
| `src/test/analysis.test.ts` (12) | Stop-loss detection, risk breach, emotional/rule/FOMO flags, repeated losing setups, lot-size variance, interpretation labelling, severity sorting, audit scores, investigation coverage |
| `src/test/coach.test.ts` (8) | Empty-journal messaging, local-engine disclosure, intent routing, no `NaN`/`undefined` leakage, no profit guarantees, all suggested questions |
| `src/test/app.test.tsx` (3) | Login screen render, demo entry, local-mode disclosure, markdown renderer |
| `src/test/pages.smoke.test.tsx` (21) | Every page mounts with real demo data; empty-journal states do not fabricate figures |
| `src/test/flows.test.tsx` (22) | Mounts the real `<App />` (router + providers): all 20 routes resolve, the auth guard redirects, a trade can be logged → persisted → listed in the journal, account deletion clears storage and returns to login, CSV export writes a real file with the documented header |

## What the assertions protect

- **Money math** is checked against hand-computed values (e.g. 0.1 lot XAUUSD × 400 ticks = $40), so a
  refactor that breaks the P&L formula fails loudly.
- **Safety language** — a test asserts the coach never emits "guaranteed", "risk-free" or "sure profit".
- **Honesty** — the dashboard empty state must not display `$10,000.00` as if it were performance.
- **No crash on missing data** — every page is rendered with a populated store and with an empty one.
- **Wiring** — `flows.test.tsx` fails if a route is removed from the router, if the seeded/ demo store stops
  persisting a new trade, or if account deletion leaves data behind.

## Not covered by automation

- Real Supabase round-trips (requires a project) — see the RLS verification query in DATABASE.md.
- Real LLM output quality (non-deterministic).
- Pixel-level visual regression.
- Native Android instrumentation.

## Manual QA script (10 minutes)

1. Login → demo data → Dashboard shows equity, charts and one "Hiro's read" finding.
2. Journal → filter by session → CSV downloads and opens in a spreadsheet.
3. Add trade with stop but no strategy → warning appears; save → detail page shows `—` R.
4. Edit that trade to closed with exit → P&L and R update everywhere.
5. Risk → change balance → dashboard equity recalculates.
6. Audit → generate → findings list → save → Reports shows the saved entry → PDF opens.
7. Coach → ask "what is my biggest mistake" → answer cites the same finding titles.
8. AI Config → remove key → status flips to Local statistical engine and answers still work.
9. Resize to 380 px → bottom nav, floating add button, no horizontal scroll.
10. Settings → Install app → PWA prompts (Chrome/Edge).
