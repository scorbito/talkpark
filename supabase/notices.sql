-- Phase 9.5: Notices (공지) — 운영자가 사용자에게 알리는 공지사항
--
-- 운영 모델:
--   - 운영자(service role 또는 admin client)만 INSERT/UPDATE/DELETE
--   - 모든 사용자(익명 포함)는 SELECT 가능
--   - is_pinned 가 true 면 항상 상단 고정
--   - published_at 이 미래거나 null 이면 비공개 (예약 발행 가능)
--
-- 본 SQL 은 idempotent.

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notices_published_at_idx on public.notices (published_at desc);
create index if not exists notices_pinned_idx on public.notices (is_pinned) where is_pinned = true;

-- updated_at 자동 갱신 트리거
create or replace function public.set_notices_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists notices_set_updated_at on public.notices;
create trigger notices_set_updated_at
  before update on public.notices
  for each row execute function public.set_notices_updated_at();

-- RLS: 모두 read, write 는 service role 만 (anon/authenticated 모두 INSERT/UPDATE/DELETE 차단)
alter table public.notices enable row level security;

drop policy if exists "notices_public_read" on public.notices;
create policy "notices_public_read"
on public.notices
for select
to anon, authenticated
using (published_at <= now());

-- INSERT/UPDATE/DELETE 정책은 만들지 않음 → service role 만 통과 (RLS bypass)
-- 운영자는 Supabase Studio 또는 admin client 로만 작성 가능

-- 샘플 데이터 (실제 운영 전에 삭제 또는 수정)
insert into public.notices (title, body, is_pinned, published_at) values
  (
    '오늘은 승요에 오신 걸 환영해요!',
    E'KBO 직관을 기록하고 친구와 공유하는 서비스입니다.\n\n주요 기능:\n- 직관 일정 자동 연동\n- 티켓 사진으로 자동 인증\n- 후기 작성 및 친구 공유\n- 응원팀 승률 추적\n\n궁금한 점은 언제든 마이 → 설정 → 문의하기로 알려주세요.',
    true,
    now()
  )
on conflict do nothing;
