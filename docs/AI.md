# AI design

## Principles

1. **Grounded** — the model receives a JSON snapshot of the user's own statistics and is instructed never
   to invent trades, prices or dates.
2. **Humble** — verified facts and interpretations are labelled separately in the UI and in the prompt.
3. **Safe** — no profit guarantees, no price predictions, no trade execution. Enforced in the system prompt
   and shown as a disclaimer on every AI surface.
4. **Available** — if no provider is configured, the local statistical engine answers instead.

## Three execution paths

```
request ──► Supabase configured? ──yes──► Edge Function ──► provider (key server-side)
                    │no
                    ▼
             BYOK key in localStorage? ──yes──► provider directly (browser key, warned)
                    │no
                    ▼
             localCoach.ts (statistical engine, no network)
```

| Path | Key location | Rate limit | Streaming |
|---|---|---|---|
| Edge Function | Supabase secret | 30 req/user/hour | No (single response) |
| BYOK | browser localStorage | provider-side | Yes (SSE) |
| Local engine | none | n/a | n/a |

## What the model receives

`lib/ai/prompt.ts` builds the context from `buildAiContext()`:

- Account: starting balance, equity
- Metrics: trades, net P&L, win rate, profit factor, expectancy, avg R, drawdown, best/worst, streaks,
  average trades per day, total costs
- Sessions, strategies, setups, instruments with trade counts, P&L and win rates
- Psychology tag performance
- Detected findings (id, title, severity, frequency, impact, verified flag)
- The last 15 closed trades (compact)
- Current risk settings

Plus a hard instruction: *"All figures are computed from the trades this user recorded. No prices or
trades are invented."*

## The 20 detectors (`lib/analysis.ts`)

| # | Detector | Basis |
|---|---|---|
| 1 | Overtrading | trades/day vs limit and 1.6× average |
| 2 | Revenge trading | re-entry ≤ 30 min after a loss without size reduction |
| 3 | Impulsive re-entry | new entry ≤ 5 min after previous exit |
| 4 | Missing / manipulated stop | closed trade with no stop recorded |
| 5 | Excessive risk | risk % above the configured cap |
| 6 | Lot-size inconsistency | coefficient of variation > 45 % |
| 7 | Early exits | winner closed below 45 % of planned R:R |
| 8 | Poor R:R | planned R:R < 1.5 |
| 9 | Emotional trading | negative emotion tags |
| 10 | Unplanned trades | missing strategy/setup/notes |
| 11 | Rule violations | checklist items false |
| 12 | Daily loss breach | day P&L ≤ −daily limit |
| 13 | Repeated losing setup | ≥ 3 trades, negative net |
| 14 | Poor session selection | ≥ 4 trades, negative net |
| 15 | Overconfidence | size +50 % after a 3-win streak |
| 16 | Counter-trend exposure | tagged strategy/setup |
| 17 | Unconfirmed entries | structure-shift rule false |
| 18 | Late entries | last 30–90 min of session *(interpretation)* |
| 19 | Strategy drift | ≥ 6 distinct strategies *(interpretation)* |
| 20 | FOMO / chasing | FOMO or Revenge tags |

Detectors 18 and 19 require price context Segawa does not have, so they are explicitly
`verified: false` — the UI renders them as *interpretation*. Severity is derived from frequency,
financial impact as a share of net P&L, and risk-breach status.

## Local statistical engine

`lib/ai/localCoach.ts` routes intents with keyword matching (performance, mistakes, sessions,
strategies, gold, recent trades, streaks, discipline, weekly/monthly, risk) and composes an answer from
the same audit engine that powers the dashboards. It discloses that it is local analysis, uses markdown
tables for comparisons, and never fabricates a number.

## Prompt / privacy controls

- Only aggregated statistics and the last 15 trades leave the device — never screenshots or notes in bulk.
- Users can run everything offline with the local engine (`AI Configuration → Engine status`).
- Conversations are stored per user and deletable individually.
- Token usage is logged in `ai_usage` for cost visibility and abuse limits.

## Adding a provider

Any OpenAI-compatible base URL works. Add an entry to `PROVIDERS` in `src/pages/AiConfig.tsx` and, for
server-side use, map its secret name inside `supabase/functions/ai-coach/index.ts`.
