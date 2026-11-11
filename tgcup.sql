-- =========================================================
-- Telegoat Cup (منقول من Finalissima) — يُشغَّل مرة واحدة
-- في مشروع Supabase الخاص بنتائج التلي غوت (qzstes) → SQL Editor
-- جداول مستقلة بادئتها tgc_ ولا تلمس أي جدول موجود
-- =========================================================

create table if not exists tgc_meta (
  id int primary key,
  started boolean default false,
  start_gw int,
  current_stage text default 'groups',
  current_round int default 0,
  champion text,
  visible_gw int default 1,
  updated_at timestamptz default now()
);
insert into tgc_meta (id) values (1) on conflict (id) do nothing;

create table if not exists tgc_draw (
  id bigint generated always as identity primary key,
  pot_number int,
  group_name text,
  team text,
  position int
);

create table if not exists tgc_matches (
  id bigint generated always as identity primary key,
  stage text,
  group_name text,
  round_num int,
  gw int,
  home_team text,
  away_team text,
  home_score numeric,
  away_score numeric,
  winner text,
  is_played boolean default false,
  home_effects jsonb,
  away_effects jsonb,
  updated_at timestamptz default now()
);

create table if not exists tgc_selections (
  id bigint generated always as identity primary key,
  round int not null,
  team text not null,
  starters jsonb default '[]'::jsonb,
  bench jsonb default '[]'::jsonb,
  locked boolean default false,
  is_auto_selected boolean default false,
  updated_at timestamptz default now(),
  unique (round, team)
);

create table if not exists tgc_captains (
  team text primary key,
  captain_entry bigint,
  captain_name text,
  pin text,
  updated_at timestamptz default now()
);

create table if not exists tgc_special_config (
  team text primary key,
  chosen_moves jsonb,
  dropped_move text,
  locked boolean default false,
  updated_at timestamptz default now()
);

create table if not exists tgc_special_moves (
  id bigint generated always as identity primary key,
  round int not null,
  team text not null,
  move_type text not null,
  target_team text,
  move_data jsonb default '{}'::jsonb,
  status text default 'pending',
  result jsonb,
  updated_at timestamptz default now(),
  unique (round, team, move_type)
);

-- صلاحيات (نفس أسلوب باقي جداول الموقع)
do $$
declare t text;
begin
  foreach t in array array['tgc_meta','tgc_draw','tgc_matches','tgc_selections','tgc_captains','tgc_special_config','tgc_special_moves']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t||'_all', t);
    execute format('create policy %I on %I for all using (true) with check (true)', t||'_all', t);
    execute format('grant all on %I to anon, authenticated', t);
  end loop;
end $$;
