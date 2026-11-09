# Architecture

## Shape

```
┌────────────────────────────────────────────────────────────────────┐
│  Client (React 18 + TS + Vite)                                     │
│                                                                    │
│  Pages (20, code-split)                                            │
│      │                                                             │
│  AppContext ── store, auth session, optimistic CRUD                │
│      │                                                             │
│  Repository layer (lib/db.ts)                                      │
│      ├── LocalRepo    → localStorage, per-user namespaced          │
│      └── SupabaseRepo → PostgreSQL + RLS                           │
│                                                                    │
│  Pure engines: calc.ts · risk.ts · analysis.ts                     │
│  AI layer: ai/client.ts ──► Edge Function (server key)             │
│                        └──► BYOK provider (browser key)            │
│                        └──► localCoach.ts (no key needed)          │
└────────────────────────────────────────────────────────────────────┘
             │                                    │
             ▼                                    ▼
   GitHub Pages (static)                  Supabase
                                    • Auth (JWT)
                                    • PostgreSQL + RLS
                                    • Storage (trade-screenshots)
                                    • Edge Functions
                                        ai-coach ──► OpenAI-compatible API
                                        delete-account (service role)
```

## Why a repository abstraction

`lib/db.ts` exposes two implementations of one interface. Pages never import Supabase directly. That
gives three properties:

1. The app is fully usable with **no backend** (local demo mode), so it can be evaluated instantly.
2. Swapping to Supabase requires two environment variables, not a refactor.
3. Calculative code stays pure and testable — no network in the metrics path.

## Data flow for a trade

1. `TradeForm` builds a `Trade` draft in local component state and previews P&L live via `calc.grossPnl`.
2. On save, `AppContext.saveTrade` normalises (`quantity`, session, exit fields), writes through the
   repository, then patches in-memory state optimistically.
3. Every screen derives its view from `snapshot.trades` with `useMemo` — no duplicated metric logic.
4. `analysis.runAudit` re-derives findings on demand; nothing is persisted except saved reports.

## Metric provenance

Every displayed number traces to `lib/calc.ts`:

| Metric | Definition |
|---|---|
| Gross P&L | `(exit − entry) × direction ÷ tickSize × tickValue × lots` |
| Net P&L | gross − (commission + swap + spread + fees) |
| Risk | `|entry − stop| ÷ tickSize × tickValue × lots` |
| R-multiple | net ÷ risk (closed trades only) |
| Win rate | wins ÷ closed trades |
| Profit factor | gross profit ÷ gross loss (∞ when no losses) |
| Expectancy | winRate × avgWin − lossRate × avgLoss |
| Drawdown | running peak − equity, max over the curve |
| Streaks | consecutive same-sign net P&L runs |

## Rendering strategy

- Hash routing (`HashRouter`) so GitHub Pages and the Android `WebView` both need zero server
  rewrite rules, and deep links survive refreshes.
- `React.lazy` per page with a mascot loading fallback.
- Manual vendor chunks (`react`, `charts`, `supabase`, `pdf`) so the dashboard does not download charts
  until it needs them.
- Charts are SVG via Recharts and degrade to empty containers under zero width.
- An `ErrorBoundary` keeps a crash local and offers a reload / sign-out path.

## Resilience

| Failure | Behaviour |
|---|---|
| No Supabase env vars | Local demo mode, banner on login |
| No AI key | `localCoach` statistical answers, labelled |
| Provider 4xx/5xx | Falls back to local engine, toast explains |
| Network offline | Service worker serves the app shell; local data still readable |
| Corrupt localStorage row | Repo returns fallback; error boundary catches render failures |

## Security boundaries

- Browser: only `VITE_SUPABASE_URL`, anon key and function name. Enforced by a CI grep.
- Edge Function: service role + provider key, never returned to the client.
- Database: RLS `auth.uid() = user_id` on select/insert/update/delete for all user tables.
