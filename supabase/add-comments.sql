-- Phase 8.5 후속: 후기 댓글 기능
-- Supabase SQL Editor에서 실행.

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_comments_body_not_blank check (length(trim(body)) >= 1),
  constraint review_comments_body_max check (length(body) <= 500)
);

create index if not exists review_comments_review_id_created_at_idx
  on public.review_comments (review_id, created_at desc);

drop trigger if exists review_comments_touch_updated_at on public.review_comments;
create trigger review_comments_touch_updated_at
before update on public.review_comments
for each row execute function public.touch_updated_at();

alter table public.review_comments enable row level security;

-- 읽기: 해당 후기를 볼 수 있는 사람만 (reviews의 가시 정책 재사용)
drop policy if exists "comments visible by review scope" on public.review_comments;
create policy "comments visible by review scope" on public.review_comments
for select using (
  exists (
    select 1 from public.reviews r
    where r.id = review_comments.review_id
      and (
        r.public_scope = 'public'
        or r.user_id = auth.uid()
        or (
          r.public_scope = 'friends'
          and exists (
            select 1 from public.friends f
            where (f.user_a_id = auth.uid() and f.user_b_id = r.user_id)
               or (f.user_b_id = auth.uid() and f.user_a_id = r.user_id)
          )
        )
      )
  )
);

-- 작성: 본인만, 단 후기를 볼 수 있어야 함
drop policy if exists "users insert own comments" on public.review_comments;
create policy "users insert own comments" on public.review_comments
for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.reviews r
    where r.id = review_comments.review_id
      and (
        r.public_scope = 'public'
        or r.user_id = auth.uid()
        or (
          r.public_scope = 'friends'
          and exists (
            select 1 from public.friends f
            where (f.user_a_id = auth.uid() and f.user_b_id = r.user_id)
               or (f.user_b_id = auth.uid() and f.user_a_id = r.user_id)
          )
        )
      )
  )
);

-- 삭제: 본인 댓글 또는 후기 작성자
drop policy if exists "users delete own or as review owner" on public.review_comments;
create policy "users delete own or as review owner" on public.review_comments
for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from public.reviews r
    where r.id = review_comments.review_id and r.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
