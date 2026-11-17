-- HowMarket schema (Supabase / Postgres).
-- Run in the Supabase SQL editor. Accuracy rules here mirror src/lib/consensus.ts.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  area text not null default 'Ibadan',
  trust numeric not null default 1 check (trust between 0.2 and 2),
  created_at timestamptz not null default now()
);

create table if not exists public.markets (
  id text primary key,
  name text not null,
  area text not null
);

create table if not exists public.items (
  id text primary key,
  name text not null,
  unit text not null,
  emoji text not null default '🛒'
);

create table if not exists public.price_reports (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.items,
  market_id text not null references public.markets,
  user_id uuid not null default auth.uid() references public.profiles,
  -- sanity bounds: no zero, negative or absurd prices
  price numeric not null check (price > 0 and price < 100000000),
  created_at timestamptz not null default now()
);
create index if not exists price_reports_lookup on public.price_reports (item_id, market_id, created_at desc);

create table if not exists public.report_votes (
  report_id uuid not null references public.price_reports on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)            -- one vote per person per report
);

-- Reports with vote counts (what the app reads)
create or replace view public.price_reports_with_votes with (security_invoker = true) as
select r.*,
       coalesce(sum(case when v.vote = 1 then 1 end), 0)  as confirms,
       coalesce(sum(case when v.vote = -1 then 1 end), 0) as flags
from public.price_reports r
left join public.report_votes v on v.report_id = r.id
group by r.id;

-- Server-side median over the last 14 days (the app adds recency/trust weighting and outlier removal)
create or replace view public.price_medians with (security_invoker = true) as
select item_id, market_id,
       percentile_cont(0.5) within group (order by price) as median_price,
       count(distinct user_id) as reporters,
       max(created_at) as updated_at
from public.price_reports
where created_at > now() - interval '14 days'
group by item_id, market_id;

-- Abuse guard: at most 20 reports per user per day
create or replace function public.enforce_report_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.price_reports
      where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily report limit reached';
  end if;
  return new;
end $$;
drop trigger if exists report_limit on public.price_reports;
create trigger report_limit before insert on public.price_reports
  for each row execute function public.enforce_report_limit();

-- No voting on your own reports
create or replace function public.no_self_votes() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.price_reports where id = new.report_id and user_id = new.user_id) then
    raise exception 'You cannot vote on your own report';
  end if;
  return new;
end $$;
drop trigger if exists no_self_vote on public.report_votes;
create trigger no_self_vote before insert on public.report_votes
  for each row execute function public.no_self_votes();

-- Create a profile row on sign-up (name/area come from the OTP sign-in metadata)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, area)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), coalesce(new.raw_user_meta_data->>'area', 'Ibadan'));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.markets enable row level security;
alter table public.items enable row level security;
alter table public.price_reports enable row level security;
alter table public.report_votes enable row level security;

create policy "read profiles" on public.profiles for select using (true);
create policy "update own profile (not trust)" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and trust = (select trust from public.profiles where id = auth.uid()));
create policy "read markets" on public.markets for select using (true);
create policy "read items" on public.items for select using (true);
create policy "read reports" on public.price_reports for select using (true);
create policy "insert own reports" on public.price_reports for insert with check (auth.uid() = user_id);
create policy "read votes" on public.report_votes for select using (true);
create policy "insert own votes" on public.report_votes for insert with check (auth.uid() = user_id);

-- Starter data
insert into public.markets (id, name, area) values
  ('bodija','Bodija Market','Ibadan'), ('oja-oba','Oja Oba','Ibadan'), ('dugbe','Dugbe Market','Ibadan'),
  ('mile12','Mile 12 Market','Lagos'), ('oyingbo','Oyingbo Market','Lagos'), ('wuse','Wuse Market','Abuja')
on conflict do nothing;
insert into public.items (id, name, unit, emoji) values
  ('rice-50kg','Rice','50kg bag','🍚'), ('garri-paint','Garri (white)','paint bucket','🥣'),
  ('beans-paint','Beans (oloyin)','paint bucket','🫘'), ('tomato-basket','Tomatoes','big basket','🍅'),
  ('palm-oil-25l','Palm oil','25 litres','🛢️'), ('yam-tuber','Yam','medium tuber','🍠'),
  ('eggs-crate','Eggs','crate (30)','🥚'), ('onions-bag','Onions','small bag','🧅')
on conflict do nothing;
