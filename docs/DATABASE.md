# Database reference

Two migrations:

| File | Purpose |
|---|---|
| `supabase/migrations/20240101000000_init.sql` | Tables, indexes, triggers, new-user bootstrap |
| `supabase/migrations/20240101000100_rls.sql` | Row Level Security + storage policies |

Apply with `supabase db push`, or paste both files into the Supabase SQL editor in order.

## Tables

| Table | Key columns | Relations |
|---|---|---|
| `profiles` | `id`, `user_id`, `email`, `full_name`, `plan` | `user_id → auth.users` |
| `accounts` | `name`, `broker`, `currency`, `starting_balance` | `user_id → auth.users` |
| `trades` | 30+ trading fields, `screenshots` jsonb, `emotions` jsonb, `rule_checklist` jsonb | `user_id`, `account_id` |
| `trade_screenshots` | `storage_path`, `caption` | `trade_id → trades (cascade)` |
| `strategies` | `name`, `description`, `rules` jsonb | `user_id` |
| `risk_settings` | limits, contract defaults, sizing mode | one row per user (`unique user_id`) |
| `challenge_profiles` | balances, targets, drawdown %, phase, status | `user_id` |
| `journal_notes` | `date`, `title`, `body`, `tags` jsonb | `user_id` |
| `psychology_entries` | `date`, `emotions`, `mood`, `discipline`, `stress` | `user_id` |
| `ai_conversations` | `title`, `updated_at` | `user_id` |
| `ai_messages` | `role`, `content`, `provider`, `tokens` | `conversation_id → ai_conversations (cascade)` |
| `ai_trade_analyses` | `analysis` jsonb, `source`, `model` | `trade_id → trades (cascade)` |
| `monthly_reports` | `period`, `metrics`, `findings`, `recommendations`, `source` | `user_id` |
| `notifications` | `title`, `body`, `kind`, `read`, `href` | `user_id` |
| `user_preferences` | AI provider/model/temperature, currency, timezone, defaults | one row per user |
| `ai_usage` | `model`, `tokens`, `created_at` | `user_id` — rate limiting & audit |

## Indexes

`trades(user_id, entry_time desc)`, `trades(user_id, status)`, `trades(user_id, instrument)`,
`trades(user_id, exit_time desc)`, `messages(conversation_id, created_at)`,
`notifications(user_id, read, created_at desc)`, plus per-table `user_id` indexes on high-traffic tables.

## Constraints that protect data quality

- `direction in ('buy','sell')`, `market` enum, `status in ('open','closed')`
- `trades_closed_needs_exit`: a closed trade must have an exit price
- `mood`/`discipline`/`stress` bounded 1–10
- `risk_settings.user_id` and `user_preferences.user_id` are `unique` so upserts are idempotent

## Row Level Security

Every user table has four policies:

```sql
using (auth.uid() = user_id)                     -- select
with check (auth.uid() = user_id)                -- insert
using (auth.uid() = user_id) with check (...)    -- update
using (auth.uid() = user_id)                     -- delete
```

Verification query (should return zero rows):

```sql
select 'trades' t, count(*) from public.trades where user_id <> auth.uid();
```

## New-user bootstrap

`handle_new_user()` (security definer trigger on `auth.users`) creates the profile row, default risk
settings, default preferences, a main account and a welcome notification. The client then only needs
`select` calls — no race on first login.

## Backup

Supabase dashboard → **Database → Backups** (daily on paid plans). For a portable copy:

```bash
pg_dump "$SUPABASE_DB_URL" --no-owner --no-acl -f segawa-backup.sql
```

Per-user export is built into the app: **Profile → Export all data (JSON)**.

## Account deletion

`delete-account` Edge Function authenticates the caller, deletes their storage objects, then deletes the
user with the service-role key; `on delete cascade` removes every dependent row.
