-- Phase 8.9: Anonymous user policies (정책 C)
--
-- 익명 user(auth.jwt()->>'is_anonymous' = 'true')에 대해:
--   - 본인 데이터(직관/후기/사진/댓글/좋아요/저장/프로필)는 정식 user와 동일하게 자유 접근
--   - 후기 공개 범위는 'public' 만 INSERT 허용 (friends/private 차단)
--   - friends / friend_requests INSERT 차단
--
-- 적용 후엔 Supabase Dashboard → Authentication → Providers → Anonymous sign-ins ON 도 함께 확인.
--
-- 본 SQL은 idempotent — 여러 번 실행해도 같은 상태로 수렴.

-- ============================================================
-- reviews: 익명 user는 public_scope = 'public' 만 INSERT 가능
-- ============================================================
drop policy if exists "anon_reviews_insert_public_only" on public.reviews;
create policy "anon_reviews_insert_public_only"
on public.reviews
as restrictive
for insert
to authenticated
with check (
  -- 정식 user는 모든 scope 허용
  (auth.jwt()->>'is_anonymous')::boolean is not true
  -- 익명 user는 public 만 허용
  or public_scope = 'public'
);

-- 후기 UPDATE 시에도 동일 — 익명이 friends/private으로 변경 불가
drop policy if exists "anon_reviews_update_public_only" on public.reviews;
create policy "anon_reviews_update_public_only"
on public.reviews
as restrictive
for update
to authenticated
with check (
  (auth.jwt()->>'is_anonymous')::boolean is not true
  or public_scope = 'public'
);

-- ============================================================
-- friend_requests: 익명 user는 INSERT/UPDATE 차단
-- ============================================================
drop policy if exists "anon_friend_requests_block" on public.friend_requests;
create policy "anon_friend_requests_block"
on public.friend_requests
as restrictive
for all
to authenticated
using ((auth.jwt()->>'is_anonymous')::boolean is not true)
with check ((auth.jwt()->>'is_anonymous')::boolean is not true);

-- ============================================================
-- friends: 익명 user는 INSERT/UPDATE 차단
-- ============================================================
drop policy if exists "anon_friends_block" on public.friends;
create policy "anon_friends_block"
on public.friends
as restrictive
for all
to authenticated
using ((auth.jwt()->>'is_anonymous')::boolean is not true)
with check ((auth.jwt()->>'is_anonymous')::boolean is not true);

-- 본 정책들은 RESTRICTIVE 로 동작 — 기존 PERMISSIVE 정책들과 AND 조건으로 결합됨.
-- 즉 본인 user_id 매칭(기존 정책) AND 익명 제한(이 정책) 모두 통과해야 권한 OK.
