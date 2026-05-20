-- =====================================================================
-- 시즌 레벨 — 1일 1직관 trigger + season_xp_events 테이블 + RLS/GRANT
-- =====================================================================
-- 적용 전 check-attendance-duplicates.sql 실행해 중복 데이터 없는지 확인.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 1일 1직관 검증 trigger
-- ---------------------------------------------------------------------
-- attendances에 별도 날짜 컬럼을 추가하지 않고, INSERT/UPDATE 시점에
-- games.game_date를 조인해 같은 날짜에 이미 직관이 있는지 검사.
-- 우천 연기로 games.game_date가 바뀌어도 동기화 부담 없음.
-- 기존 unique(user_id, game_id)는 그대로 유지(같은 경기 중복 방지).
-- ---------------------------------------------------------------------

create or replace function public.check_one_attendance_per_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_game_date date;
  existing_count int;
begin
  -- 현재 INSERT/UPDATE 대상 attendance의 게임 날짜
  select game_date into new_game_date
    from public.games
    where id = new.game_id;

  if new_game_date is null then
    -- game_id가 존재하지 않으면 별도 FK 제약이 처리하도록 패스
    return new;
  end if;

  -- 같은 사용자 + 같은 game_date의 다른 직관 존재 여부.
  -- UPDATE의 경우 자기 자신은 제외해야 정상 동작.
  select count(*) into existing_count
    from public.attendances a
    join public.games g on g.id = a.game_id
    where a.user_id = new.user_id
      and g.game_date = new_game_date
      and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if existing_count > 0 then
    raise exception '하루에 하나의 직관만 기록할 수 있어요.'
      using errcode = '23505';  -- unique_violation
  end if;

  return new;
end;
$$;

drop trigger if exists one_attendance_per_day on public.attendances;
create trigger one_attendance_per_day
  before insert or update on public.attendances
  for each row execute function public.check_one_attendance_per_day();


-- ---------------------------------------------------------------------
-- 2) season_xp_events 테이블 — XP 이벤트 로그
-- ---------------------------------------------------------------------
-- 단순 합계 컬럼 대신 이벤트 로그로 관리 (지급/회수 모두 추적, 멱등 보장).
-- xp는 양수(지급) / 음수(회수). 현재 시즌 XP는 user_id+season으로 sum.
-- ---------------------------------------------------------------------

create table if not exists public.season_xp_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  season      int not null,
  type        text not null,
  source_id   uuid not null,
  xp          int not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- 멱등성 보장: 같은 (user_id, season, type, source_id) 조합은 1개만 허용.
-- 백필/실시간 지급이 같은 source에 중복 row를 만들지 못하게 함.
-- 회수 이벤트(type에 _revoked 등 접미사)는 별도 type이라 충돌 안 함.
create unique index if not exists season_xp_events_unique_event
  on public.season_xp_events (user_id, season, type, source_id);

-- 사용자별 시즌 XP 조회용 인덱스
create index if not exists season_xp_events_user_season_idx
  on public.season_xp_events (user_id, season);


-- ---------------------------------------------------------------------
-- 3) GRANT (Supabase Data API 2026-10-30 변경 대비)
-- ---------------------------------------------------------------------
-- 새 테이블은 명시적 GRANT 없이는 PostgREST에서 접근 불가.
-- - authenticated: 본인 row SELECT만. INSERT/UPDATE/DELETE는 service role로만.
-- - service_role: 전체 권한 (서버 액션에서 admin client로 지급/회수).
-- ---------------------------------------------------------------------

grant select on public.season_xp_events to authenticated;
grant insert, update, delete on public.season_xp_events to service_role;


-- ---------------------------------------------------------------------
-- 4) RLS (Row Level Security)
-- ---------------------------------------------------------------------
-- 본인 row만 SELECT 가능. 친구의 시즌 XP는 서버 액션의 service role로 조회.
-- ---------------------------------------------------------------------

alter table public.season_xp_events enable row level security;

drop policy if exists "users read own season xp events" on public.season_xp_events;
create policy "users read own season xp events"
  on public.season_xp_events
  for select
  to authenticated
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 검증 쿼리 (선택)
-- ---------------------------------------------------------------------
-- 적용 후 다음을 실행해 정상 동작 확인:
--
-- 1. trigger 등록 확인:
--    select tgname from pg_trigger where tgrelid = 'public.attendances'::regclass;
--    -> one_attendance_per_day 가 보여야 함
--
-- 2. 1일 1직관 차단 테스트 (본인 계정으로 같은 날 다른 경기 등록 시도):
--    -> '하루에 하나의 직관만 기록할 수 있어요.' 에러 발생해야 함
--
-- 3. season_xp_events INSERT 차단 확인 (authenticated 권한으로 직접 INSERT 시도):
--    -> 권한 에러 발생해야 함 (service role만 가능)
