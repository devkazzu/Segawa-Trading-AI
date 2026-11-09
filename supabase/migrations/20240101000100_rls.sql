-- ============================================================================
-- Row Level Security. A user may only ever read or write their own rows.
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.accounts            enable row level security;
alter table public.trades              enable row level security;
alter table public.trade_screenshots   enable row level security;
alter table public.strategies          enable row level security;
alter table public.risk_settings       enable row level security;
alter table public.challenge_profiles  enable row level security;
alter table public.journal_notes       enable row level security;
alter table public.psychology_entries  enable row level security;
alter table public.ai_conversations    enable row level security;
alter table public.ai_messages         enable row level security;
alter table public.ai_trade_analyses   enable row level security;
alter table public.monthly_reports     enable row level security;
alter table public.notifications       enable row level security;
alter table public.user_preferences    enable row level security;
alter table public.ai_usage            enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'accounts','trades','trade_screenshots','strategies','risk_settings','challenge_profiles',
    'journal_notes','psychology_entries','ai_conversations','ai_messages','ai_trade_analyses',
    'monthly_reports','notifications','user_preferences','ai_usage','profiles'
  ]
  loop
    execute format('drop policy if exists "own_rows_select" on public.%I', t);
    execute format('drop policy if exists "own_rows_insert" on public.%I', t);
    execute format('drop policy if exists "own_rows_update" on public.%I', t);
    execute format('drop policy if exists "own_rows_delete" on public.%I', t);

    execute format('create policy "own_rows_select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own_rows_insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own_rows_update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own_rows_delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- AI usage is written by the Edge Function with the user's JWT; users may read
-- their own usage but never fabricate it.
drop policy if exists "own_rows_insert" on public.ai_usage;
create policy "own_usage_insert" on public.ai_usage for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: private bucket for trade screenshots, one folder per user.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', false)
on conflict (id) do nothing;

drop policy if exists "shots_read_own" on storage.objects;
drop policy if exists "shots_write_own" on storage.objects;
drop policy if exists "shots_delete_own" on storage.objects;

create policy "shots_read_own" on storage.objects
  for select using (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "shots_write_own" on storage.objects
  for insert with check (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "shots_delete_own" on storage.objects
  for delete using (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[1]);
