-- 누락된 테이블 + RLS 일괄 복구.
-- attendances 이후 나머지 테이블이 안 만들어진 상태에서 사용.
-- Supabase SQL Editor에서 한 번에 실행.

-- ─────────────────────────────────────────
-- 0. 공통 함수 (touch_updated_at)
-- ─────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ─────────────────────────────────────────
-- 1. friends + friend_requests
-- ─────────────────────────────────────────
create table if not exists public.friends (
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  constraint friends_no_self check (user_a_id <> user_b_id),
  constraint friends_sorted_pair check (user_a_id < user_b_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  status friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_no_self check (from_user_id <> to_user_id)
);

create unique index if not exists friend_requests_pending_unique
  on public.friend_requests(from_user_id, to_user_id)
  where status = 'pending';

-- ─────────────────────────────────────────
-- 2. reviews + review_likes + review_saves
-- ─────────────────────────────────────────
create table if not exists public.reviews (
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

create table if not exists public.review_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

create table if not exists public.review_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, review_id)
);

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
before update on public.reviews
for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- 3. notifications
-- ─────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  type notification_type not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- 4. RLS enable + 정책
-- ─────────────────────────────────────────
alter table public.friends enable row level security;
alter table public.friend_requests enable row level security;
alter table public.reviews enable row level security;
alter table public.review_likes enable row level security;
alter table public.review_saves enable row level security;
alter table public.notifications enable row level security;

-- friends: 자기 행만 조회 가능
drop policy if exists "users read own friends" on public.friends;
create policy "users read own friends" on public.friends
for select using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- friend_requests
drop policy if exists "users read related friend requests" on public.friend_requests;
create policy "users read related friend requests" on public.friend_requests
for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "users create outbound friend requests" on public.friend_requests;
create policy "users create outbound friend requests" on public.friend_requests
for insert with check (auth.uid() = from_user_id);

drop policy if exists "request recipients respond" on public.friend_requests;
create policy "request recipients respond" on public.friend_requests
for update using (auth.uid() = to_user_id);

-- reviews: 공개 범위 + 친구 공개 지원
drop policy if exists "reviews visible by scope" on public.reviews;
create policy "reviews visible by scope" on public.reviews
for select using (
  public_scope = 'public'
  or user_id = auth.uid()
  or (
    public_scope = 'friends'
    and exists (
      select 1 from public.friends f
      where (f.user_a_id = auth.uid() and f.user_b_id = reviews.user_id)
         or (f.user_b_id = auth.uid() and f.user_a_id = reviews.user_id)
    )
  )
);

drop policy if exists "users insert own reviews" on public.reviews;
create policy "users insert own reviews" on public.reviews for insert with check (auth.uid() = user_id);
drop policy if exists "users update own reviews" on public.reviews;
create policy "users update own reviews" on public.reviews for update using (auth.uid() = user_id);
drop policy if exists "users delete own reviews" on public.reviews;
create policy "users delete own reviews" on public.reviews for delete using (auth.uid() = user_id);

-- review_likes
drop policy if exists "users read own likes" on public.review_likes;
create policy "users read own likes" on public.review_likes for select using (auth.uid() = user_id);
drop policy if exists "users like as self" on public.review_likes;
create policy "users like as self" on public.review_likes for insert with check (auth.uid() = user_id);
drop policy if exists "users unlike own likes" on public.review_likes;
create policy "users unlike own likes" on public.review_likes for delete using (auth.uid() = user_id);

-- review_saves
drop policy if exists "users read own saves" on public.review_saves;
create policy "users read own saves" on public.review_saves for select using (auth.uid() = user_id);
drop policy if exists "users save as self" on public.review_saves;
create policy "users save as self" on public.review_saves for insert with check (auth.uid() = user_id);
drop policy if exists "users unsave own saves" on public.review_saves;
create policy "users unsave own saves" on public.review_saves for delete using (auth.uid() = user_id);

-- notifications
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
for select using (auth.uid() = recipient_user_id);
drop policy if exists "users mark own notifications" on public.notifications;
create policy "users mark own notifications" on public.notifications
for update using (auth.uid() = recipient_user_id);

-- ─────────────────────────────────────────
-- 5. PostgREST 스키마 캐시 reload
-- ─────────────────────────────────────────
notify pgrst, 'reload schema';
