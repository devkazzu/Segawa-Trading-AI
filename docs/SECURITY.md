# Security

## Threat model

| Asset | Threat | Control |
|---|---|---|
| Trade history | Cross-user read via API | RLS `auth.uid() = user_id` on every table + storage folder |
| Provider API key | Leak via bundle/repo | Never referenced in `frontend/`; lives in Supabase secrets; CI greps for key patterns |
| Supabase service role | Privilege escalation | Used only inside Edge Functions, never sent to the client |
| Screenshots | Unauthorised access | Private bucket; policies keyed on the user's folder name |
| Auth session | Token theft | Supabase JWT with auto-refresh; no tokens persisted in URLs |
| AI abuse | Cost amplification | JWT required, 16 messages max, 60k context cap, 30 requests/hour/user, usage logging |
| Data loss | Accidental deletion | JSON export, Supabase backups, confirmation dialogs on destructive actions |

## Environment separation

```
Browser (public)          Edge Function (secret)         Database (RLS)
VITE_SUPABASE_URL         OPENAI_API_KEY                 auth.uid() policies
VITE_SUPABASE_ANON_KEY    SUPABASE_SERVICE_ROLE_KEY       storage folder policies
VITE_AI_FUNCTION          provider tokens
```

`frontend/src/lib/env.ts` actively warns if a secret-looking value appears in the anon-key slot
(`sk-…`, `sb_secret_…`, `service_role`), and the Pages workflow fails the build on the same patterns.

## Authentication

- Supabase Auth (email + password) with compulsory email verification in production.
- Local demo mode uses SHA-256 hashed passwords in `localStorage`: convenient for evaluation,
  **explicitly not** a production identity system, and labelled as such on login/register.
- Sign-out clears the session; account deletion removes profile, trades, storage objects and the auth user.

## AI safety

- The system prompt forbids inventing data, predicting prices, guaranteeing profit and executing trades.
- The model only sees aggregated statistics plus the last 15 trades.
- Every AI surface shows a "not financial advice" disclaimer.
- Prompt injection surface is limited: user text is a normal chat message; the trading context is
  delivered as a separate system turn the model is told not to exceed.

## Input validation

- Client: numeric guards (positive lots, non-zero ticks, closed trades require exit price), enum-bound
  selects, image type/size checks before compression.
- Database: CHECK constraints on direction, market, status, mood ranges, and
  `trades_closed_needs_exit`.
- Edge Function: role whitelist, message count/size limits, temperature clamped to 0–2.

## Checklist before going public

- [ ] Rotate the anon key if it was ever pasted publicly (anon is public by design, but rotate on suspicion).
- [ ] Confirm the service-role key exists nowhere in the repo: `git grep -n "service_role"`.
- [ ] `supabase secrets list` shows provider keys; the repo shows none.
- [ ] RLS enabled on all tables: `select tablename, rowsecurity from pg_tables where schemaname='public';`
- [ ] Storage bucket `trade-screenshots` is **not** public.
- [ ] Enable Supabase Auth rate limits and CAPTCHA for production sign-up.
- [ ] Serve over HTTPS only (GitHub Pages and the Android WebView both do).

## Reporting

This is a portfolio/commercial-template project. If you deploy it for real users, add a security contact
and a privacy policy URL to the repository settings and the Settings screen.
