-- Today Win Phase 7 Supabase schema draft.
-- Apply after the Supabase project is created. This assumes Supabase Auth owns auth.users.

create extension if not exists pgcrypto;

create type game_status as enum ('scheduled', 'in_progress', 'finished', 'canceled');
create type attendance_result as enum ('win', 'lose', 'draw');
create type verified_method as enum ('ticket_image_vision', 'manual', 'mock');
create type public_scope as enum ('public', 'friends', 'private');
create type friend_request_status as enum ('pending', 'accepted', 'rejected', 'canceled');
create type notification_type as enum (
  'friend_request',
  'friend_accepted',
  'review_like',
  'review_comment',
  'attendance_verified',
  'system'
);

create table public.teams (
  id text primary key,
  name text not null,
  short_name text not null,
  initial text not null,
  color text not null,
  accent text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  main_team_id text not null references public.teams(id),
  main_team_changed_at timestamptz,
  interest_team_ids text[] not null default '{}',
  notifications_enabled boolean not null default true,
  default_public_scope public_scope not null default 'public',
  avatar_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_interest_team_count check (array_length(interest_team_ids, 1) is null or array_length(interest_team_ids, 1) <= 5)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  game_date date not null,
  game_time time,
  stadium text not null,
  home_team_id text not null references public.teams(id),
  away_team_id text not null references public.teams(id),
  home_score integer,
  away_score integer,
  status game_status not null default 'scheduled',
  innings integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint games_different_teams check (home_team_id <> away_team_id),
  constraint games_scores_complete_when_finished check (
    status <> 'finished' or (home_score is not null and away_score is not null)
  )
);

create table public.team_standings (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(id),
  season integer not null,
  rank integer not null,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  games_behind text not null default '-',
  form attendance_result[] not null default '{}',
  source_payload jsonb,
  synced_at timestamptz not null default now(),
  unique (team_id, season)
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete restrict,
  support_team_id text not null references public.teams(id),
  ticket_image_url text,
  ticket_image_hash text,
  verified boolean not null default false,
  verified_at timestamptz,
  verified_method verified_method,
  vision_payload jsonb,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_id),
  constraint attendances_verified_requires_ticket check (
    verified = false or ticket_image_url is not null
  )
);

create unique index attendances_ticket_image_hash_unique
  on public.attendances(ticket_image_hash)
  where ticket_image_hash is not null;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_id uuid not null unique references public.attendances(id) on delete cascade,
  body text not null,
  photos text[] not null default '{}',
  public_scope public_scope not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_body_not_blank check (length(trim(body)) >= 5),
  constraint reviews_photo_count check (array_length(photos, 1) is null or array_length(photos, 1) between 1 and 3)
);

create table public.review_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

create table public.review_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

create table public.friends (
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  constraint friends_no_self check (user_a_id <> user_b_id),
  constraint friends_sorted_pair check (user_a_id < user_b_id)
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  status friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_no_self check (from_user_id <> to_user_id)
);

create unique index friend_requests_pending_unique
  on public.friend_requests(from_user_id, to_user_id)
  where status = 'pending';

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  type notification_type not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger games_touch_updated_at
before update on public.games
for each row execute function public.touch_updated_at();

create trigger attendances_touch_updated_at
before update on public.attendances
for each row execute function public.touch_updated_at();

create trigger reviews_touch_updated_at
before update on public.reviews
for each row execute function public.touch_updated_at();

create or replace function public.game_result_for_support_team(
  home_team_id text,
  away_team_id text,
  home_score integer,
  away_score integer,
  support_team_id text
)
returns attendance_result
language sql
immutable
as $$
  select case
    when home_score is null or away_score is null then null
    when home_score = away_score then 'draw'::attendance_result
    when support_team_id = home_team_id and home_score > away_score then 'win'::attendance_result
    when support_team_id = away_team_id and away_score > home_score then 'win'::attendance_result
    when support_team_id in (home_team_id, away_team_id) then 'lose'::attendance_result
    else null
  end;
$$;

-- security_invoker=on: view를 query하는 사용자의 권한 + RLS로 baseline 테이블에 접근.
-- 미설정 시 view 생성자(postgres) 권한으로 동작해 RLS 우회됨 (Supabase Linter Critical).
create or replace view public.verified_attendance_results
with (security_invoker = on) as
select
  a.id,
  a.user_id,
  a.game_id,
  a.support_team_id,
  public.game_result_for_support_team(
    g.home_team_id,
    g.away_team_id,
    g.home_score,
    g.away_score,
    a.support_team_id
  ) as result
from public.attendances a
join public.games g on g.id = a.game_id
where a.verified = true
  and g.status = 'finished';

create or replace view public.profile_stats
with (security_invoker = on) as
select
  p.id as user_id,
  count(r.id)::integer as attendance_count,
  count(r.id) filter (where r.result = 'win')::integer as wins,
  count(r.id) filter (where r.result = 'lose')::integer as losses,
  count(r.id) filter (where r.result = 'draw')::integer as draws,
  case
    when count(r.id) filter (where r.result in ('win', 'lose')) = 0 then 0
    else round(
      (count(r.id) filter (where r.result = 'win'))::numeric
      / nullif(count(r.id) filter (where r.result in ('win', 'lose')), 0),
      3
    )
  end as win_rate
from public.profiles p
left join public.verified_attendance_results r on r.user_id = p.id
group by p.id;

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.team_standings enable row level security;
alter table public.attendances enable row level security;
alter table public.reviews enable row level security;
alter table public.review_likes enable row level security;
alter table public.review_saves enable row level security;
alter table public.friends enable row level security;
alter table public.friend_requests enable row level security;
alter table public.notifications enable row level security;

create policy "teams are public readable" on public.teams for select using (true);
create policy "games are public readable" on public.games for select using (true);
create policy "standings are public readable" on public.team_standings for select using (true);

create policy "profiles are public readable" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

create policy "users read own attendances" on public.attendances for select using (auth.uid() = user_id);
create policy "users insert own attendances" on public.attendances for insert with check (auth.uid() = user_id);
create policy "users update own attendances" on public.attendances for update using (auth.uid() = user_id);
create policy "users delete own attendances" on public.attendances for delete using (auth.uid() = user_id);

create policy "reviews visible by scope" on public.reviews
for select using (
  public_scope = 'public'
  or user_id = auth.uid()
  or (
    public_scope = 'friends'
    and exists (
      select 1
      from public.friends f
      where (f.user_a_id = auth.uid() and f.user_b_id = reviews.user_id)
         or (f.user_b_id = auth.uid() and f.user_a_id = reviews.user_id)
    )
  )
);
create policy "users insert own reviews" on public.reviews for insert with check (auth.uid() = user_id);
create policy "users update own reviews" on public.reviews for update using (auth.uid() = user_id);
create policy "users delete own reviews" on public.reviews for delete using (auth.uid() = user_id);

create policy "users read own likes" on public.review_likes for select using (auth.uid() = user_id);
create policy "users like as self" on public.review_likes for insert with check (auth.uid() = user_id);
create policy "users unlike own likes" on public.review_likes for delete using (auth.uid() = user_id);

create policy "users read own saves" on public.review_saves for select using (auth.uid() = user_id);
create policy "users save as self" on public.review_saves for insert with check (auth.uid() = user_id);
create policy "users unsave own saves" on public.review_saves for delete using (auth.uid() = user_id);

create policy "users read own friends" on public.friends
for select using (auth.uid() = user_a_id or auth.uid() = user_b_id);

create policy "users read related friend requests" on public.friend_requests
for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "users create outbound friend requests" on public.friend_requests
for insert with check (auth.uid() = from_user_id);
create policy "request recipients respond" on public.friend_requests
for update using (auth.uid() = to_user_id or auth.uid() = from_user_id);

create policy "users read own notifications" on public.notifications
for select using (auth.uid() = recipient_user_id);
create policy "users mark own notifications" on public.notifications
for update using (auth.uid() = recipient_user_id);
