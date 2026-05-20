-- Phase 9.5+: games.last_synced_at — on-demand 동기화 throttle용
--
-- 사용자가 "경기 종료" 버튼을 눌러서 finalizeAttendanceAction이 KBO API를 호출할 때마다
-- 이 컬럼을 업데이트. 같은 게임에 60초 이내 재호출이 들어오면 API 호출을 생략하고
-- 현재 DB 상태를 반환.
--
-- 본 SQL 은 idempotent.

alter table public.games
  add column if not exists last_synced_at timestamptz;

-- 이미 동기화된 종료 경기는 last_synced_at 을 일관되게 채워두기 (선택 — null이어도 동작 OK)
update public.games
set last_synced_at = updated_at
where last_synced_at is null and status = 'finished';

create index if not exists games_last_synced_idx on public.games (last_synced_at);
