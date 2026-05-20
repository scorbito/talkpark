-- 경기톡 (Match Talk) 기능
-- 기획: docs/planning/match-talk.md
-- 개발 계획: docs/development/match-talk-implementation.md
--
-- Supabase SQL Editor에서 한 번 실행. 후기 댓글 마이그레이션(add-comments.sql) 이후에 적용.

-- 1. enum
do $$ begin
  create type match_post_emotion_tag as enum ('cheer', 'support', 'anger', 'anxiety');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_post_status_snapshot as enum ('scheduled', 'in_progress', 'finished');
exception when duplicate_object then null; end $$;

-- 2. games 테이블에 라이브 스코어 lazy refresh용 컬럼 추가
alter table public.games
  add column if not exists last_live_synced_at timestamptz;

-- 3. match_posts 본 테이블
create table if not exists public.match_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete restrict,
  body text not null,
  photo_url text,
  emotion_tag match_post_emotion_tag not null,
  score_home_at_post integer,
  score_away_at_post integer,
  status_at_post match_post_status_snapshot not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint match_posts_body_not_blank check (length(trim(body)) >= 1),
  constraint match_posts_body_max check (length(body) <= 300),
  -- 스코어가 들어있으면 둘 다 들어있어야 함 (한쪽만 NULL인 상태 방지)
  constraint match_posts_scores_paired check (
    (score_home_at_post is null and score_away_at_post is null)
    or (score_home_at_post is not null and score_away_at_post is not null)
  )
);

-- 인덱스: 경기별 최신순 (가장 흔한 쿼리), 사용자별 최신순 (마이/프로필)
-- soft-deleted 글은 제외하는 부분 인덱스로 활성 글 조회 비용 최소화
create index if not exists match_posts_game_id_created_at_idx
  on public.match_posts (game_id, created_at desc)
  where deleted_at is null;

create index if not exists match_posts_user_id_created_at_idx
  on public.match_posts (user_id, created_at desc)
  where deleted_at is null;

drop trigger if exists match_posts_touch_updated_at on public.match_posts;
create trigger match_posts_touch_updated_at
before update on public.match_posts
for each row execute function public.touch_updated_at();

-- 4. match_post_likes
create table if not exists public.match_post_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_post_id uuid not null references public.match_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, match_post_id)
);

create index if not exists match_post_likes_post_id_idx
  on public.match_post_likes (match_post_id);

-- 5. match_post_comments
create table if not exists public.match_post_comments (
  id uuid primary key default gen_random_uuid(),
  match_post_id uuid not null references public.match_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_post_comments_body_not_blank check (length(trim(body)) >= 1),
  constraint match_post_comments_body_max check (length(body) <= 500)
);

create index if not exists match_post_comments_post_id_created_at_idx
  on public.match_post_comments (match_post_id, created_at desc);

drop trigger if exists match_post_comments_touch_updated_at on public.match_post_comments;
create trigger match_post_comments_touch_updated_at
before update on public.match_post_comments
for each row execute function public.touch_updated_at();

-- 6. RLS 활성화
alter table public.match_posts enable row level security;
alter table public.match_post_likes enable row level security;
alter table public.match_post_comments enable row level security;

-- 7. match_posts 정책
-- 조회: 비로그인 포함 누구나 (soft-deleted 제외) — 랜딩에서 활기를 보여주기 위함
drop policy if exists "match posts are public readable" on public.match_posts;
create policy "match posts are public readable" on public.match_posts
for select using (deleted_at is null);

-- 작성: 본인만
drop policy if exists "users insert own match posts" on public.match_posts;
create policy "users insert own match posts" on public.match_posts
for insert with check (auth.uid() = user_id);

-- 수정: 본인만 (MVP는 글 수정 미지원이지만 soft delete를 위해 update 권한 필요)
drop policy if exists "users update own match posts" on public.match_posts;
create policy "users update own match posts" on public.match_posts
for update using (auth.uid() = user_id);

-- 삭제: 본인만 (실제 삭제 — soft delete는 update로 처리하지만 hard delete도 본인만)
drop policy if exists "users delete own match posts" on public.match_posts;
create policy "users delete own match posts" on public.match_posts
for delete using (auth.uid() = user_id);

-- 8. match_post_likes 정책 (후기 좋아요와 동일 패턴)
drop policy if exists "match post likes are public readable" on public.match_post_likes;
create policy "match post likes are public readable" on public.match_post_likes
for select using (true);

drop policy if exists "users like match posts as self" on public.match_post_likes;
create policy "users like match posts as self" on public.match_post_likes
for insert with check (auth.uid() = user_id);

drop policy if exists "users unlike own match post likes" on public.match_post_likes;
create policy "users unlike own match post likes" on public.match_post_likes
for delete using (auth.uid() = user_id);

-- 9. match_post_comments 정책
-- 조회: 누구나 (글 자체가 공개이므로 댓글도 동일)
drop policy if exists "match post comments are public readable" on public.match_post_comments;
create policy "match post comments are public readable" on public.match_post_comments
for select using (
  exists (
    select 1 from public.match_posts p
    where p.id = match_post_comments.match_post_id
      and p.deleted_at is null
  )
);

-- 작성: 본인 + 살아있는 글에 대해서만
drop policy if exists "users insert own match post comments" on public.match_post_comments;
create policy "users insert own match post comments" on public.match_post_comments
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.match_posts p
    where p.id = match_post_comments.match_post_id
      and p.deleted_at is null
  )
);

-- 삭제: 본인 댓글 또는 글 작성자 (후기 댓글과 동일 정책)
drop policy if exists "users delete own match post comments or as post owner" on public.match_post_comments;
create policy "users delete own match post comments or as post owner" on public.match_post_comments
for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from public.match_posts p
    where p.id = match_post_comments.match_post_id
      and p.user_id = auth.uid()
  )
);

-- 10. 사진 Storage 정책
-- 후기와 같은 review-photos 버킷을 폴더로 구분해 재사용한다.
-- 폴더 구조: {user_id}/reviews/...  vs  {user_id}/match-talk/...
-- 기존 review-photos 정책(auth.uid()::text = (storage.foldername(name))[1])이
-- 이미 user_id 폴더 기준이라 추가 정책은 필요 없음. 앱에서 업로드 시 경로만 분리.

notify pgrst, 'reload schema';
