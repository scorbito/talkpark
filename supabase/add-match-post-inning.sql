-- 경기톡 글 작성 시점의 이닝(회차) 스냅샷
-- Supabase SQL Editor에서 한 번 실행.

alter table public.match_posts
  add column if not exists inning_at_post integer;
