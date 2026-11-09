-- ============================================================================
-- Segawa TradeAI — core schema
-- Every table is owned by a user and protected by Row Level Security.
-- Run with:  supabase db push      (or paste into the SQL editor)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  email        text,
  full_name    text,
  avatar_url   text,
  plan         text not null default 'free' check (plan in ('free', 'pro')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- accounts
create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null default 'Main account',
  broker           text,
  currency         text not null default 'USD',
  starting_balance numeric(18, 2) not null default 10000,
  is_default       boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- trades
create table if not exists public.trades (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  account_id     text,
  instrument     text not null,
  market         text not null default 'commodities' check (market in ('forex','indices','commodities','crypto','stocks')),
  direction      text not null check (direction in ('buy','sell')),
  entry_price    numeric(20, 8) not null,
  exit_price     numeric(20, 8),
  stop_loss      numeric(20, 8),
  take_profit    numeric(20, 8),
  lot_size       numeric(18, 4) not null default 0.01,
  quantity       numeric(18, 4) not null default 0.01,
  contract_size  numeric(18, 4) not null default 100,
  tick_size      numeric(20, 10) not null default 0.01,
  tick_value     numeric(18, 6) not null default 1,
  currency       text not null default 'USD',
  entry_time     timestamptz not null default now(),
  exit_time      timestamptz,
  session        text not null default 'London',
  timeframe      text not null default 'M15',
  strategy       text default '',
  setup          text default '',
  risk_percent   numeric(6, 3) not null default 1,
  commission     numeric(14, 2) not null default 0,
  swap           numeric(14, 2) not null default 0,
  spread         numeric(14, 2) not null default 0,
  fees           numeric(14, 2) not null default 0,
  status         text not null default 'open' check (status in ('open','closed')),
  screenshots    jsonb not null default '[]'::jsonb,
  notes          text default '',
  emotions       jsonb not null default '[]'::jsonb,
  rule_checklist jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint trades_closed_needs_exit check (status = 'open' or exit_price is not null)
);

create index if not exists trades_user_entry_idx on public.trades (user_id, entry_time desc);
create index if not exists trades_user_status_idx on public.trades (user_id, status);
create index if not exists trades_user_instrument_idx on public.trades (user_id, instrument);
create index if not exists trades_user_exit_idx on public.trades (user_id, exit_time desc);

-- ------------------------------------------------------- trade screenshots
create table if not exists public.trade_screenshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  trade_id     uuid not null references public.trades (id) on delete cascade,
  storage_path text not null,
  caption      text,
  created_at   timestamptz not null default now()
);
create index if not exists trade_shots_user_idx on public.trade_screenshots (user_id);
create index if not exists trade_shots_trade_idx on public.trade_screenshots (trade_id);

-- --------------------------------------------------------------- strategies
create table if not exists public.strategies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text default '',
  rules       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists strategies_user_idx on public.strategies (user_id);

-- ------------------------------------------------------------ risk settings
create table if not exists public.risk_settings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users (id) on delete cascade,
  account_balance       numeric(18, 2) not null default 10000,
  max_risk_per_trade    numeric(6, 3) not null default 1,
  daily_loss_limit      numeric(18, 2) not null default 300,
  weekly_loss_limit     numeric(18, 2) not null default 750,
  max_drawdown          numeric(6, 3) not null default 10,
  daily_trade_limit     integer not null default 5,
  consecutive_loss_alert integer not null default 3,
  default_contract_size numeric(18, 4) not null default 100,
  default_tick_size     numeric(20, 10) not null default 0.01,
  default_tick_value    numeric(18, 6) not null default 1,
  risk_per_trade_mode   text not null default 'percent' check (risk_per_trade_mode in ('percent','fixed')),
  fixed_risk_amount     numeric(18, 2) not null default 100,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ------------------------------------------------------- challenge profiles
create table if not exists public.challenge_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  name                text not null,
  firm                text default '',
  starting_balance    numeric(18, 2) not null default 10000,
  current_balance     numeric(18, 2) not null default 10000,
  profit_target_pct   numeric(6, 2) not null default 8,
  daily_drawdown_pct  numeric(6, 2) not null default 5,
  overall_drawdown_pct numeric(6, 2) not null default 10,
  phase               text default 'Phase 1',
  trading_days        integer not null default 0,
  min_trading_days    integer not null default 5,
  start_date          timestamptz not null default now(),
  status              text not null default 'active' check (status in ('active','passed','failed','archived')),
  notes               text default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists challenges_user_idx on public.challenge_profiles (user_id);

-- ----------------------------------------------------------- journal notes
create table if not exists public.journal_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null default current_date,
  title      text not null default '',
  body       text default '',
  tags       jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notes_user_date_idx on public.journal_notes (user_id, date desc);

-- ------------------------------------------------------ psychology entries
create table if not exists public.psychology_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  date       date not null default current_date,
  emotions   jsonb not null default '[]'::jsonb,
  mood       integer not null default 5 check (mood between 1 and 10),
  discipline integer not null default 5 check (discipline between 1 and 10),
  stress     integer not null default 5 check (stress between 1 and 10),
  note       text default '',
  created_at timestamptz not null default now()
);
create index if not exists psych_user_date_idx on public.psychology_entries (user_id, date desc);

-- --------------------------------------------------------- AI conversations
create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  content         text not null,
  provider        text,
  tokens          integer,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.ai_messages (conversation_id, created_at);

create table if not exists public.ai_trade_analyses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  trade_id   uuid references public.trades (id) on delete cascade,
  source     text not null default 'local-analysis',
  model      text,
  analysis   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analyses_user_idx on public.ai_trade_analyses (user_id);

-- --------------------------------------------------------- monthly reports
create table if not exists public.monthly_reports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  period          text not null,
  title           text not null,
  summary         text default '',
  metrics         jsonb not null default '{}'::jsonb,
  findings        jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  source          text not null default 'local-analysis' check (source in ('ai','local-analysis')),
  created_at      timestamptz not null default now()
);
create index if not exists reports_user_period_idx on public.monthly_reports (user_id, period desc);

-- ----------------------------------------------------------- notifications
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  body       text default '',
  kind       text not null default 'info' check (kind in ('info','warning','success','risk')),
  read       boolean not null default false,
  href       text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, read, created_at desc);

-- -------------------------------------------------------- user preferences
create table if not exists public.user_preferences (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references auth.users (id) on delete cascade,
  ai_provider          text not null default 'openai',
  ai_model             text not null default 'gpt-4o-mini',
  ai_base_url          text not null default 'https://api.openai.com/v1',
  ai_temperature       numeric(3, 2) not null default 0.40,
  currency             text not null default 'USD',
  timezone             text not null default 'UTC',
  starting_balance     numeric(18, 2) not null default 10000,
  default_instrument   text not null default 'XAUUSD',
  default_risk_percent numeric(6, 3) not null default 1,
  compact_mode         boolean not null default false,
  mascot_enabled       boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ------------------------------------------- AI usage (rate limiting/audit)
create table if not exists public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  model      text,
  tokens     integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','accounts','trades','strategies','risk_settings','challenge_profiles','ai_conversations','user_preferences']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- New-user bootstrap: profile, risk settings and preferences
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, user_id, email, full_name)
  values (new.id, new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  insert into public.risk_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.accounts (user_id, name) values (new.id, 'Main account');
  insert into public.notifications (user_id, title, body, kind)
  values (new.id, 'Welcome to Segawa TradeAI', 'Log your first trade to unlock analytics and the AI coach.', 'info');
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
